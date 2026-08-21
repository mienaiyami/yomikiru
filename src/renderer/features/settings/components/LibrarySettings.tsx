import { useDirectoryValidator } from "@features/reader/hooks/useDirectoryValidator";
import { setAppSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import store from "@store/index";
import { fetchAllItemsWithProgress } from "@store/library";
import { blockUi, UI_BLOCK_ID_LIBRARY, unblockUi } from "@store/ui";
import InputCheckbox from "@ui/InputCheckbox";
import InputNumber from "@ui/InputNumber";
import InputSelect from "@ui/InputSelect";
import { dialogUtils } from "@utils/dialog";
import { promptSelectDir } from "@utils/file";
import { regenerateLibraryThumbnails, showRegenSkippedWarning } from "@utils/libraryCoverService";
import {
    getExistingBaseDir,
    isDuplicateLibraryFolderPath,
    type LibraryScanRoot,
    libraryFolderScanRoot,
    listManualLibraryScanRoots,
    scanLibraryRoots,
    showImportFinishedSummary,
    withLibraryScanTimestamps,
} from "@utils/librarySettingsImport";
import { createRendererLogger } from "@utils/logger";
import { LIBRARY_SCAN_MAX_DEPTH_CEILING } from "@utils/mangaChapters";
import type { LibraryFolderSetting } from "@utils/settingsSchema";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

const log = createRendererLogger("settings/LibrarySettings");

const LIBRARY_FOLDER_CONTENT = ["manga", "book", "both"] as const;

type LibraryFolderContent = (typeof LIBRARY_FOLDER_CONTENT)[number];

const isLibraryFolderContent = (value: string): value is LibraryFolderContent =>
    (LIBRARY_FOLDER_CONTENT as readonly string[]).includes(value);

/**
 * New library-folder row after the user picks a directory.
 */
const newLibraryFolderSetting = (folderPath: string): LibraryFolderSetting => ({
    path: window.path.normalize(folderPath),
    content: "both",
    maxDepth: LIBRARY_SCAN_MAX_DEPTH_CEILING,
    scanOnStart: false,
    scanIntervalHours: 0,
    watch: false,
    lastScanAtMs: 0,
});

type LibrarySettingsBusy = "clear" | "regen" | "importChildren" | null;

/**
 * Settings for how the library finds titles on disk and refreshes cover thumbnails.
 */
const LibrarySettings: React.FC = () => {
    const { t } = useTranslation("settings");
    const dispatch = useAppDispatch();
    const appSettings = useAppSelector((s) => s.appSettings);
    const libraryItems = useAppSelector((s) => s.library.items);
    const libraryScanBusy = useAppSelector((s) => s.ui.libraryScanBusy);
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

    const persistScanTimestamps = (paths: readonly string[]): void => {
        const latest = store.getState().appSettings;
        dispatch(setAppSettings(withLibraryScanTimestamps(latest, paths)));
    };

    /**
     * Locks the UI, walks `roots`, stamps last-scan times, and optionally shows the summary dialog.
     */
    const runScan = async (roots: readonly LibraryScanRoot[], showSummary: boolean): Promise<void> => {
        if (roots.length === 0) {
            if (showSummary) dialogUtils.customError({ message: t("library.scanNoRoots") });
            return;
        }
        await runBusy(
            "importChildren",
            t("library.importError"),
            async () => {
                const existingLinks = new Set(Object.keys(store.getState().library.items));
                const { added, skipped, failed, ran } = await scanLibraryRoots(roots, {
                    dispatch,
                    keepExtractedFiles: store.getState().appSettings.keepExtractedFiles,
                    validateDirectory,
                    existingLinks,
                    onProgress: (done, total) => {
                        const label = `${done} / ${total}`;
                        setImportLabel(label);
                        setLibraryBlockMessage(t("library.importing", { label }));
                    },
                });
                if (ran) persistScanTimestamps(roots.map((r) => r.path));
                await dispatch(fetchAllItemsWithProgress());
                log.info("library scan", { added, skipped, failed, ran, paths: roots.map((r) => r.path) });
                if (showSummary && ran) await showImportFinishedSummary(added, skipped, failed);
            },
            t("library.importing", { label: "" }),
        );
    };

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

    const confirmThenScan = async (roots: readonly LibraryScanRoot[]): Promise<void> => {
        const { response } = await dialogUtils.warn({
            title: t("library.importTitle"),
            message: t("library.importMessage"),
            noOption: false,
            buttons: [t("shared.cancel"), t("library.importBtn")],
            defaultId: 0,
        });
        if (!response) return;
        await runScan(roots, true);
    };

    const patchFolder = (index: number, patch: Partial<LibraryFolderSetting>): void => {
        dispatch(
            setAppSettings({
                libraryFolders: appSettings.libraryFolders.map((folder, i) =>
                    i === index ? { ...folder, ...patch } : folder,
                ),
            }),
        );
    };

    const handleAddFolder = (): void => {
        promptSelectDir((selected) => {
            const folderPath = Array.isArray(selected) ? selected[0] : selected;
            if (!folderPath) return;
            if (isDuplicateLibraryFolderPath(appSettings.libraryFolders, folderPath)) {
                dialogUtils.customError({ message: t("library.folderAlreadyAdded") });
                return;
            }
            dispatch(
                setAppSettings({
                    libraryFolders: [...appSettings.libraryFolders, newLibraryFolderSetting(folderPath)],
                }),
            );
        });
    };

    const disabled = busy !== null;
    // start/interval walks share the in-flight lock; keep Scan now from stacking on them
    const scanDisabled = disabled || libraryScanBusy;
    const scanBusyLabel =
        busy === "importChildren" ? t("library.importing", { label: importLabel }) : t("library.scanNow");
    const scanThisLabel =
        busy === "importChildren" ? t("library.importing", { label: importLabel }) : t("library.scanThisFolder");

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
                    <div className="toggleItem" id="settings-scan-default-location">
                        <InputCheckbox
                            checked={appSettings.scanDefaultLocation}
                            className="noBG"
                            disabled={disabled}
                            onChange={(e) => {
                                dispatch(setAppSettings({ scanDefaultLocation: e.currentTarget.checked }));
                            }}
                            labelAfter={t("library.scanDefaultLocation")}
                        />
                        <div className="desc">{t("library.scanDefaultLocationDesc")}</div>
                    </div>
                    <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                        <InputNumber
                            value={appSettings.scanDefaultLocationIntervalHours}
                            min={0}
                            step={1}
                            disabled={disabled || !appSettings.scanDefaultLocation}
                            className="noBG"
                            labelBefore={t("library.scanDefaultLocationInterval")}
                            labelAfter={t("library.hoursUnit")}
                            timeout={[
                                500,
                                (value) => {
                                    dispatch(
                                        setAppSettings({
                                            scanDefaultLocationIntervalHours: Math.max(0, Math.round(value)),
                                        }),
                                    );
                                },
                            ]}
                        />
                    </div>
                    <div className="desc">{t("library.intervalHoursHint")}</div>
                    <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                        <button
                            type="button"
                            disabled={scanDisabled}
                            onClick={() => {
                                const baseDir = getExistingBaseDir(appSettings.baseDir);
                                if (!baseDir) {
                                    dialogUtils.customError({ message: t("library.setDefaultFirst") });
                                    return;
                                }
                                void confirmThenScan([
                                    { path: baseDir, content: "both", maxDepth: LIBRARY_SCAN_MAX_DEPTH_CEILING },
                                ]);
                            }}
                        >
                            {scanThisLabel}
                        </button>
                    </div>
                </div>

                <div className="col" id="settings-library-folders">
                    <h4>{t("library.foldersTitle")}</h4>
                    <div className="desc">{t("library.foldersDesc")}</div>
                    <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                        <button type="button" disabled={disabled} onClick={handleAddFolder}>
                            {t("library.addFolder")}
                        </button>
                    </div>
                    {appSettings.libraryFolders.map((folder, index) => (
                        <div
                            key={`${folder.path}-${index}`}
                            className="col"
                            style={{ marginTop: "0.75rem", gap: "0.35rem" }}
                        >
                            <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                                <input type="text" value={folder.path} readOnly />
                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => {
                                        promptSelectDir((selected) => {
                                            const folderPath = Array.isArray(selected) ? selected[0] : selected;
                                            if (!folderPath) return;
                                            const others = appSettings.libraryFolders.filter(
                                                (_, i) => i !== index,
                                            );
                                            if (isDuplicateLibraryFolderPath(others, folderPath)) {
                                                dialogUtils.customError({
                                                    message: t("library.folderAlreadyAdded"),
                                                });
                                                return;
                                            }
                                            patchFolder(index, { path: window.path.normalize(folderPath) });
                                        });
                                    }}
                                >
                                    {t("library.changeFolder")}
                                </button>
                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => {
                                        dispatch(
                                            setAppSettings({
                                                libraryFolders: appSettings.libraryFolders.filter(
                                                    (_, i) => i !== index,
                                                ),
                                            }),
                                        );
                                    }}
                                >
                                    {t("shared.remove")}
                                </button>
                            </div>
                            <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                                <InputSelect
                                    value={folder.content}
                                    disabled={disabled}
                                    className="noBG"
                                    labelBefore={t("library.contentLabel")}
                                    onChange={(value) => {
                                        if (isLibraryFolderContent(value)) patchFolder(index, { content: value });
                                    }}
                                    options={[
                                        { label: t("library.contentManga"), value: "manga" },
                                        { label: t("library.contentBook"), value: "book" },
                                        { label: t("library.contentBoth"), value: "both" },
                                    ]}
                                />
                                <InputNumber
                                    value={folder.maxDepth}
                                    min={0}
                                    max={LIBRARY_SCAN_MAX_DEPTH_CEILING}
                                    step={1}
                                    disabled={disabled}
                                    className="noBG"
                                    labelBefore={t("library.maxDepth")}
                                    timeout={[
                                        500,
                                        (value) => {
                                            patchFolder(index, {
                                                maxDepth: Math.min(
                                                    LIBRARY_SCAN_MAX_DEPTH_CEILING,
                                                    Math.max(0, Math.round(value)),
                                                ),
                                            });
                                        },
                                    ]}
                                />
                            </div>
                            <div className="toggleItem">
                                <InputCheckbox
                                    checked={folder.scanOnStart}
                                    className="noBG"
                                    disabled={disabled}
                                    onChange={(e) => {
                                        patchFolder(index, { scanOnStart: e.currentTarget.checked });
                                    }}
                                    labelAfter={t("library.scanOnStart")}
                                />
                            </div>
                            <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                                <InputNumber
                                    value={folder.scanIntervalHours}
                                    min={0}
                                    step={1}
                                    disabled={disabled}
                                    className="noBG"
                                    labelBefore={t("library.intervalHours")}
                                    labelAfter={t("library.hoursUnit")}
                                    timeout={[
                                        500,
                                        (value) => {
                                            patchFolder(index, {
                                                scanIntervalHours: Math.max(0, Math.round(value)),
                                            });
                                        },
                                    ]}
                                />
                            </div>
                            <div className="toggleItem">
                                <InputCheckbox
                                    checked={folder.watch}
                                    className="noBG"
                                    disabled
                                    title={t("library.watchUnavailable")}
                                    onChange={() => undefined}
                                    labelAfter={t("library.watch")}
                                />
                                <div className="desc">{t("library.watchDesc")}</div>
                            </div>
                            <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                                <button
                                    type="button"
                                    disabled={scanDisabled}
                                    onClick={() => {
                                        const root = libraryFolderScanRoot(folder);
                                        if (!root) {
                                            dialogUtils.customError({ message: t("library.folderMissing") });
                                            return;
                                        }
                                        void confirmThenScan([root]);
                                    }}
                                >
                                    {scanThisLabel}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="col" id="settings-library-scan-now">
                    <h4>{t("library.scanNow")}</h4>
                    <div className="desc">
                        {t("library.scanDescBefore")}
                        <code>.epub</code>
                        {t("library.scanDescAfter")}
                    </div>
                    <div className="desc">{t("library.scanNowDesc")}</div>
                    <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                        <button
                            type="button"
                            disabled={scanDisabled}
                            onClick={() => {
                                const roots = listManualLibraryScanRoots(appSettings);
                                if (roots.length === 0) {
                                    dialogUtils.customError({ message: t("library.scanNoRoots") });
                                    return;
                                }
                                void confirmThenScan(roots);
                            }}
                        >
                            {scanBusyLabel}
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
