import { useDirectoryValidator } from "@features/reader/hooks/useDirectoryValidator";
import { setAppSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import store from "@store/index";
import { fetchAllItemsWithProgress } from "@store/library";
import { UI_BLOCK_ID_LIBRARY, blockUi, unblockUi } from "@store/ui";
import { dialogUtils } from "@utils/dialog";
import { promptSelectDir } from "@utils/file";
import { regenerateLibraryThumbnails, showRegenSkippedWarning } from "@utils/libraryCoverService";
import {
    addEpubAtNormalizedPath,
    addMangaFolderAtNormalizedPath,
    getExistingBaseDir,
    showImportFinishedSummary,
} from "@utils/librarySettingsImport";
import { createRendererLogger } from "@utils/logger";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

const log = createRendererLogger("settings/LibrarySettings");

type LibrarySettingsBusy = "clear" | "regen" | "importChildren" | "importEpubsRecursive" | null;

/**
 * Library settings: Default Location (Locations tab + bulk import), thumbnail
 * cache, and import from that folder.
 */
const LibrarySettings: React.FC = () => {
    const { t } = useTranslation("settings");
    const dispatch = useAppDispatch();
    const appSettings = useAppSelector((s) => s.appSettings);
    const libraryItems = useAppSelector((s) => s.library.items);
    const { validateDirectory } = useDirectoryValidator();

    const [busy, setBusy] = useState<LibrarySettingsBusy>(null);
    const [regenLabel, setRegenLabel] = useState("");
    const [importLabel, setImportLabel] = useState("");

    /**
     * Runs a long-running settings action with a shared busy/label lifecycle: sets `busy`,
     * optionally locks the app UI, resets labels / `busy` / the lock in `finally`, and
     * surfaces a user-visible dialog plus logger call on error.
     */
    const runBusy = useCallback(
        async (
            key: Exclude<LibrarySettingsBusy, null>,
            errorMessage: string,
            work: () => Promise<void>,
            uiLockMessage?: string,
        ): Promise<void> => {
            setBusy(key);
            if (uiLockMessage !== undefined) {
                dispatch(blockUi({ id: UI_BLOCK_ID_LIBRARY, message: uiLockMessage }));
            }
            try {
                await work();
            } catch (e) {
                log.error(`${key} failed`, e);
                dialogUtils.customError({ message: errorMessage });
            } finally {
                if (uiLockMessage !== undefined) dispatch(unblockUi(UI_BLOCK_ID_LIBRARY));
                setImportLabel("");
                setRegenLabel("");
                setBusy(null);
            }
        },
        [dispatch],
    );

    /** Replaces the overlay status text for the Settings library lock id. */
    const setLibraryBlockMessage = useCallback(
        (message: string) => {
            dispatch(blockUi({ id: UI_BLOCK_ID_LIBRARY, message }));
        },
        [dispatch],
    );

    const handleClearCache = useCallback(async () => {
        const { response } = await dialogUtils.warn({
            title: t("library.clearCacheTitle"),
            message: t("library.clearCacheMessage"),
            detail: t("library.clearCacheDetail"),
            noOption: false,
            buttons: [t("shared.cancel"), t("shared.clear")],
            defaultId: 0,
        });
        if (!response) return;
        await runBusy("clear", t("library.clearCacheError"), async () => {
            const res = await window.electron.invoke("covers:clearCache");
            if (!res.ok) {
                dialogUtils.customError({ message: res.message || t("library.clearCacheError") });
                return;
            }
            await dispatch(fetchAllItemsWithProgress());
        });
    }, [dispatch, runBusy, t]);

    const handleRegenerateAll = useCallback(async () => {
        const { response } = await dialogUtils.warn({
            title: t("library.regenTitle"),
            message: t("library.regenMessage"),
            detail: t("library.regenDetail"),
            noOption: false,
            buttons: [t("shared.cancel"), t("library.regenerate")],
            defaultId: 0,
        });
        if (!response) return;
        let skippedMissing = 0;
        let regenFinished = false;
        await runBusy("regen", t("library.regenError"), async () => {
            const list = Object.values(libraryItems).filter(
                (item): item is NonNullable<typeof item> => item != null,
            );
            const result = await regenerateLibraryThumbnails(dispatch, list, validateDirectory, (done, total) => {
                setRegenLabel(`${done} / ${total}`);
            });
            skippedMissing = result.skippedMissing;
            await dispatch(fetchAllItemsWithProgress());
            regenFinished = true;
        });
        // skip the summary dialog if runBusy already showed regenError
        if (regenFinished) await showRegenSkippedWarning(skippedMissing);
    }, [dispatch, libraryItems, validateDirectory, runBusy, t]);

    /**
     * Adds one immediate child of the default folder: a manga folder if it validates as a packed series,
     * or a `.epub` file as a book. Everything else (including already-indexed paths) is skipped.
     */
    const tryAddImmediateChild = useCallback(
        async (fullPath: string): Promise<"added" | "skipped" | "failed"> => {
            const norm = window.path.normalize(fullPath);
            if (store.getState().library.items[norm]) return "skipped";

            try {
                const st = await window.fs.stat(norm);
                if (st.isFile) {
                    if (window.path.extname(norm).toLowerCase() !== ".epub") return "skipped";
                    return addEpubAtNormalizedPath(norm, {
                        dispatch,
                        keepExtractedFiles: appSettings.keepExtractedFiles,
                    });
                }
                if (!st.isDir) return "skipped";
                return addMangaFolderAtNormalizedPath(norm, { dispatch, validateDirectory });
            } catch (e) {
                log.error("tryAddImmediateChild failed", norm, e);
                return "failed";
            }
        },
        [appSettings.keepExtractedFiles, dispatch, validateDirectory],
    );

    const handleImportDefaultFolderChildren = useCallback(async () => {
        const baseDir = getExistingBaseDir(appSettings.baseDir);
        if (!baseDir) {
            dialogUtils.customError({ message: t("library.setDefaultFirst") });
            return;
        }
        const { response } = await dialogUtils.warn({
            title: t("library.importTitle"),
            message: t("library.importMessage"),
            noOption: false,
            buttons: [t("shared.cancel"), t("library.importBtn")],
            defaultId: 0,
        });
        if (!response) return;
        await runBusy(
            "importChildren",
            t("library.importError"),
            async () => {
                let added = 0;
                let skipped = 0;
                let failed = 0;
                const names = await window.fs.readdir(baseDir);
                names.sort((a, b) => a.localeCompare(b));
                let i = 0;
                for (const name of names) {
                    i += 1;
                    const label = `${i} / ${names.length}`;
                    setImportLabel(label);
                    setLibraryBlockMessage(t("library.importing", { label }));
                    const full = window.path.join(baseDir, name);
                    const r = await tryAddImmediateChild(full);
                    if (r === "added") added += 1;
                    else if (r === "skipped") skipped += 1;
                    else failed += 1;
                }
                await dispatch(fetchAllItemsWithProgress());
                log.info("import default folder children", { added, skipped, failed });
                await showImportFinishedSummary(added, skipped, failed, "folderChildren");
            },
            t("library.importing", { label: "" }),
        );
    }, [appSettings.baseDir, dispatch, tryAddImmediateChild, runBusy, setLibraryBlockMessage, t]);

    /**
     * Walks `baseDir` recursively and adds every `.epub` file not already in the library.
     */
    const handleImportAllEpubsRecursive = useCallback(async () => {
        const baseDir = getExistingBaseDir(appSettings.baseDir);
        if (!baseDir) {
            dialogUtils.customError({ message: t("library.setDefaultFirst") });
            return;
        }
        const { response } = await dialogUtils.warn({
            title: t("library.importAllEpubsTitle"),
            message: t("library.importAllEpubsMessage"),
            noOption: false,
            buttons: [t("shared.cancel"), t("library.scan")],
            defaultId: 0,
        });
        if (!response) return;
        await runBusy(
            "importEpubsRecursive",
            t("library.scanError"),
            async () => {
                const queue: string[] = [baseDir];
                let added = 0;
                let skipped = 0;
                let failed = 0;
                let scanned = 0;
                while (queue.length > 0) {
                    const dir = queue.shift();
                    if (!dir) break;
                    const entries = await window.fs.readdir(dir);
                    for (const name of entries) {
                        const full = window.path.join(dir, name);
                        const st = await window.fs.stat(full);
                        if (st.isDir) {
                            queue.push(full);
                        } else if (name.toLowerCase().endsWith(".epub")) {
                            scanned += 1;
                            const label = t("library.epubsProgress", { scanned, added });
                            setImportLabel(label);
                            setLibraryBlockMessage(t("library.scanning", { label }));
                            const norm = window.path.normalize(full);
                            if (store.getState().library.items[norm]) {
                                skipped += 1;
                                continue;
                            }
                            const r = await addEpubAtNormalizedPath(norm, {
                                dispatch,
                                keepExtractedFiles: appSettings.keepExtractedFiles,
                            });
                            if (r === "added") added += 1;
                            else failed += 1;
                        }
                    }
                }
                await dispatch(fetchAllItemsWithProgress());
                log.info("import all epubs recursive", { added, skipped, failed, scanned });
                await showImportFinishedSummary(added, skipped, failed, "recursiveEpubs");
            },
            t("library.scanning", { label: "" }),
        );
    }, [appSettings.baseDir, appSettings.keepExtractedFiles, dispatch, runBusy, setLibraryBlockMessage, t]);

    const disabled = busy !== null;

    return (
        <div className="settingItem2" id="settings-library">
            <h3>{t("library.title")}</h3>
            <div className="desc">{t("library.intro")}</div>

            {/* Same .main.col indent as reader preset h4s (not flush with the section h3). */}
            <div className="main col">
                <div className="col" id="settings-default-location">
                    <h4>{t("defaultLocation.title")}</h4>
                    <div className="desc">{t("defaultLocation.desc")}</div>
                    <div className="row">
                        <input type="text" value={appSettings.baseDir} readOnly />
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                                promptSelectDir((path) => dispatch(setAppSettings({ baseDir: path as string })));
                            }}
                        >
                            {t("defaultLocation.changeDefault")}
                        </button>
                    </div>
                </div>

                <div className="col">
                    <h4>{t("library.importFromDefault")}</h4>
                    <div className="desc">
                        <b>{t("library.immediateChildren")}</b>
                        {t("library.importPackedDescBefore")}
                        <code>.epub</code>
                        {t("library.importPackedDescAfter")}
                    </div>
                    <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                        <button type="button" disabled={disabled} onClick={() => void handleImportDefaultFolderChildren()}>
                            {busy === "importChildren"
                                ? t("library.importing", { label: importLabel })
                                : t("library.addValidItems")}
                        </button>
                        <button type="button" disabled={disabled} onClick={() => void handleImportAllEpubsRecursive()}>
                            {busy === "importEpubsRecursive"
                                ? t("library.scanning", { label: importLabel })
                                : t("library.addAllEpubs")}
                        </button>
                    </div>
                </div>

                <div className="col">
                    <h4>{t("library.thumbnails")}</h4>
                    <div className="desc">
                        {t("library.thumbnailsDescBefore")}
                        <code>covers</code>
                        {t("library.thumbnailsDescAfter")}
                    </div>
                    <div className="desc">{t("library.clearRegenDesc")}</div>
                    <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                        <button type="button" disabled={disabled} onClick={() => void handleClearCache()}>
                            {busy === "clear" ? t("library.clearing") : t("library.clearCached")}
                        </button>
                        <button type="button" disabled={disabled} onClick={() => void handleRegenerateAll()}>
                            {busy === "regen"
                                ? t("library.regenerating", { label: regenLabel })
                                : t("library.regenerateAll")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LibrarySettings;
