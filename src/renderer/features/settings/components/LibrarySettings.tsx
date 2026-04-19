import { useDirectoryValidator } from "@features/reader/hooks/useDirectoryValidator";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import store from "@store/index";
import { fetchAllItemsWithProgress } from "@store/library";
import { dialogUtils } from "@utils/dialog";
import { materializeBookLibraryThumbnail, materializeMangaLibraryThumbnail } from "@utils/libraryCoverService";
import {
    addEpubAtNormalizedPath,
    addMangaFolderAtNormalizedPath,
    getExistingBaseDir,
    showImportFinishedSummary,
} from "@utils/librarySettingsImport";
import { createRendererLogger } from "@utils/logger";
import { useCallback, useState } from "react";

const log = createRendererLogger("settings/LibrarySettings");

type LibrarySettingsBusy = "clear" | "regen" | "importChildren" | "importEpubsRecursive" | null;

/**
 * Library-related settings: thumbnail cache, bulk import from the default folder (Settings → Default Location).
 */
const LibrarySettings: React.FC = () => {
    const dispatch = useAppDispatch();
    const appSettings = useAppSelector((s) => s.appSettings);
    const libraryItems = useAppSelector((s) => s.library.items);
    const { validateDirectory } = useDirectoryValidator();

    const [busy, setBusy] = useState<LibrarySettingsBusy>(null);
    const [regenLabel, setRegenLabel] = useState("");
    const [importLabel, setImportLabel] = useState("");

    /**
     * Runs a long-running settings action with a shared busy/label lifecycle: sets `busy`, resets
     * labels and `busy` in `finally`, and surfaces a user-visible dialog plus logger call on error.
     */
    const runBusy = useCallback(
        async (
            key: Exclude<LibrarySettingsBusy, null>,
            errorMessage: string,
            work: () => Promise<void>,
        ): Promise<void> => {
            setBusy(key);
            try {
                await work();
            } catch (e) {
                log.error(`${key} failed`, e);
                dialogUtils.customError({ message: errorMessage });
            } finally {
                setImportLabel("");
                setRegenLabel("");
                setBusy(null);
            }
        },
        [],
    );

    const handleClearCache = useCallback(async () => {
        const { response } = await dialogUtils.warn({
            title: "Clear cover cache",
            message: "Remove all generated thumbnail files in the app data covers folder?",
            detail: "Gallery will show placeholders until thumbnails are created again (open items or regenerate).",
            noOption: false,
            buttons: ["Cancel", "Clear"],
            defaultId: 0,
        });
        if (!response) return;
        await runBusy("clear", "Could not clear cover cache.", async () => {
            const res = await window.electron.invoke("covers:clearCache");
            if (!res.ok) {
                dialogUtils.customError({ message: res.message || "Could not clear cover cache." });
                return;
            }
            await dispatch(fetchAllItemsWithProgress());
        });
    }, [dispatch, runBusy]);

    const handleRegenerateAll = useCallback(async () => {
        const { response } = await dialogUtils.warn({
            title: "Regenerate all covers",
            message: "Rebuild WebP thumbnails for every library item? This may take several minutes.",
            detail: "Manga uses folder cover images when present; books require reading each EPUB. You can cancel by closing the app.",
            noOption: false,
            buttons: ["Cancel", "Regenerate"],
            defaultId: 0,
        });
        if (!response) return;
        await runBusy("regen", "Regenerate stopped due to an error.", async () => {
            const list = Object.values(libraryItems).filter(
                (item): item is NonNullable<typeof item> => item != null,
            );
            let i = 0;
            for (const item of list) {
                i += 1;
                setRegenLabel(`${i} / ${list.length}`);
                if (item.id == null) continue;
                if (item.type === "manga") {
                    await materializeMangaLibraryThumbnail(dispatch, item.id, item.link, validateDirectory);
                } else {
                    await materializeBookLibraryThumbnail(dispatch, item.id, item.link);
                }
            }
            await dispatch(fetchAllItemsWithProgress());
        });
    }, [dispatch, libraryItems, validateDirectory, runBusy]);

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
            dialogUtils.customError({ message: "Set a valid Default Location first." });
            return;
        }
        const { response } = await dialogUtils.warn({
            title: "Import from default folder",
            message:
                "Add library entries for each immediate file or folder in your default location: " +
                "folders as manga (when they look like packed series), .epub files as books. " +
                "Existing entries are skipped.",
            noOption: false,
            buttons: ["Cancel", "Import"],
            defaultId: 0,
        });
        if (!response) return;
        await runBusy("importChildren", "Import stopped due to an error.", async () => {
            let added = 0;
            let skipped = 0;
            let failed = 0;
            const names = await window.fs.readdir(baseDir);
            names.sort((a, b) => a.localeCompare(b));
            let i = 0;
            for (const name of names) {
                i += 1;
                setImportLabel(`${i} / ${names.length}`);
                const full = window.path.join(baseDir, name);
                const r = await tryAddImmediateChild(full);
                if (r === "added") added += 1;
                else if (r === "skipped") skipped += 1;
                else failed += 1;
            }
            await dispatch(fetchAllItemsWithProgress());
            log.info("import default folder children", { added, skipped, failed });
            await showImportFinishedSummary(added, skipped, failed, "folderChildren");
        });
    }, [appSettings.baseDir, dispatch, tryAddImmediateChild, runBusy]);

    /**
     * Walks `baseDir` recursively and adds every `.epub` file not already in the library.
     */
    const handleImportAllEpubsRecursive = useCallback(async () => {
        const baseDir = getExistingBaseDir(appSettings.baseDir);
        if (!baseDir) {
            dialogUtils.customError({ message: "Set a valid Default Location first." });
            return;
        }
        const { response } = await dialogUtils.warn({
            title: "Import all EPUBs",
            message:
                "Scan your default folder recursively and add every .epub file as a book. " +
                "This can take a long time on large trees. Existing entries are skipped.",
            noOption: false,
            buttons: ["Cancel", "Scan"],
            defaultId: 0,
        });
        if (!response) return;
        await runBusy("importEpubsRecursive", "Scan stopped due to an error.", async () => {
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
                        setImportLabel(`EPUBs: ${scanned} scanned, +${added} added`);
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
        });
    }, [appSettings.baseDir, appSettings.keepExtractedFiles, dispatch, runBusy]);

    const disabled = busy !== null;

    return (
        <div className="settingItem2" id="settings-library">
            <h3>Library</h3>
            <div className="desc">
                Thumbnails live under app user data <code>covers</code>. Bulk import uses your{" "}
                <a
                    onClick={() => {
                        document.getElementById("settings-default-location")?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                        });
                    }}
                >
                    Default Location
                </a>{" "}
                (top of this page).
            </div>

            <div className="desc" style={{ marginTop: "1rem" }}>
                <b>Thumbnails</b>
            </div>
            <div className="desc">
                Clear generated files to free space, or rebuild WebP thumbnails for every library item.
            </div>
            <div className="main row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="button" disabled={disabled} onClick={() => void handleClearCache()}>
                    {busy === "clear" ? "Clearing…" : "Clear cached thumbnails"}
                </button>
                <button type="button" disabled={disabled} onClick={() => void handleRegenerateAll()}>
                    {busy === "regen" ? `Regenerating… ${regenLabel}` : "Regenerate all thumbnails"}
                </button>
            </div>

            <div className="desc" style={{ marginTop: "1.25rem" }}>
                <b>Import from default folder</b>
            </div>
            <div className="desc">
                <b>Immediate children:</b> each subfolder is checked as manga (packed layout); each{" "}
                <code>.epub</code> in that folder becomes a book. Invalid or unrecognized entries are skipped.
            </div>
            <div className="main row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="button" disabled={disabled} onClick={() => void handleImportDefaultFolderChildren()}>
                    {busy === "importChildren"
                        ? `Importing… ${importLabel}`
                        : "Add valid items from default folder"}
                </button>
                <button type="button" disabled={disabled} onClick={() => void handleImportAllEpubsRecursive()}>
                    {busy === "importEpubsRecursive" ? `Scanning… ${importLabel}` : "Add all EPUBs recursively"}
                </button>
            </div>
        </div>
    );
};

export default LibrarySettings;
