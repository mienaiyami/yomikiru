import {
    clampLibraryScanMaxDepth,
    extraLibraryFolders,
    getDefaultLocationFolder,
    isLibraryFolderContent,
    keepKnownLibraryFolderTagIds,
    LIBRARY_SCAN_MAX_DEPTH_CEILING,
    type LibraryFolder,
    patchLibraryFolder,
    setDefaultLocationPath,
} from "@common/library/folders";
import { useDirectoryValidator } from "@features/reader/hooks/useDirectoryValidator";
import { setAppSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import store from "@store/index";
import { deleteProgressForLinks, fetchAllItemsWithProgress } from "@store/library";
import { updateMainSettings } from "@store/mainSettings";
import { unionLibraryItemTags } from "@store/tags";
import { blockUi, UI_BLOCK_ID_LIBRARY, unblockUi } from "@store/ui";
import InputCheckbox from "@ui/InputCheckbox";
import InputNumber from "@ui/InputNumber";
import InputSelect from "@ui/InputSelect";
import { confirmWhenMany, dialogUtils } from "@utils/dialog";
import { promptSelectDir } from "@utils/file";
import { regenerateLibraryThumbnails, showRegenSkippedWarning } from "@utils/libraryCoverService";
import {
    existingLibraryFolderPaths,
    getExistingBaseDir,
    isDuplicateLibraryFolderPath,
    libraryItemLinksUnderScanRoot,
    listForeignLibraryScanSkipPaths,
    newLibraryFolderSetting,
    unusedDummyProgressLinks,
} from "@utils/librarySettingsImport";
import { createRendererLogger } from "@utils/logger";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import LibraryScanRootOptions from "./LibraryScanRootOptions";

const log = createRendererLogger("settings/LibrarySettings");

/** How long Saved / Failed stays on the folder-tag backfill button. */
const BACKFILL_FEEDBACK_RESTORE_MS = 1500;

/** Catalog ids under Library that sit inside the collapsible body (not the section heading). */
const LIBRARY_COLLAPSED_NAV_IDS = new Set([
    "setting:default-location",
    "setting:library-folders",
    "setting:library-folders-list",
    "setting:library-scan-now",
    "setting:library-clear-unused-progress",
]);

type LibrarySettingsBusy = "clear" | "regen" | "clearProgress" | null;

/**
 * Settings for how the library finds titles on disk and refreshes cover thumbnails.
 */
const LibrarySettings: React.FC = () => {
    const { t } = useTranslation("settings");
    const { t: tCommon } = useTranslation("common");
    const dispatch = useAppDispatch();
    const appSettings = useAppSelector((s) => s.appSettings);
    const folders = useAppSelector((s) => s.mainSettings.library.folders);
    const libraryItems = useAppSelector((s) => s.library.items);
    const tagCatalog = useAppSelector((s) => s.tags.catalog);
    const libraryScanStatus = useAppSelector((s) => s.ui.libraryScanStatus);
    const libraryScanBusy = libraryScanStatus != null;
    const pendingSettingsNav = useAppSelector((s) => s.ui.pendingSettingsNav);
    const { validateDirectory } = useDirectoryValidator();

    const defaultFolder = getDefaultLocationFolder(folders);
    const extras = extraLibraryFolders(folders);

    const [busy, setBusy] = useState<LibrarySettingsBusy>(null);
    const [regenLabel, setRegenLabel] = useState("");
    const [clearProgressLabel, setClearProgressLabel] = useState("");
    const [backfillFeedback, setBackfillFeedback] = useState<"idle" | "saving" | "saved" | "failed">("idle");
    const [backfillTarget, setBackfillTarget] = useState<"default" | number | null>(null);

    useEffect(() => {
        const navId = pendingSettingsNav?.id;
        if (!navId || !LIBRARY_COLLAPSED_NAV_IDS.has(navId)) return;
        const expandFoldersList =
            navId === "setting:library-folders" && extras.length > 0 && !appSettings.libraryFoldersListExpanded;
        if (!appSettings.librarySettingsExpanded || expandFoldersList) {
            dispatch(
                setAppSettings({
                    ...(appSettings.librarySettingsExpanded ? {} : { librarySettingsExpanded: true }),
                    ...(expandFoldersList ? { libraryFoldersListExpanded: true } : {}),
                }),
            );
        }
    }, [
        pendingSettingsNav?.id,
        appSettings.librarySettingsExpanded,
        appSettings.libraryFoldersListExpanded,
        extras.length,
        dispatch,
    ]);

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
                setRegenLabel("");
                setBusy(null);
            }
        },
        [dispatch],
    );

    const persistFolders = (next: LibraryFolder[]): void => {
        void dispatch(updateMainSettings({ library: { folders: next } }));
    };

    /**
     * Confirms then starts a main-process scan. Does not lock the window (title-bar status).
     */
    const runScan = async (paths: readonly string[], showSummary: boolean): Promise<void> => {
        if (paths.length === 0) {
            if (showSummary) dialogUtils.customError({ message: t("library.scanNoRoots") });
            return;
        }
        const result = await window.electron.invoke("libraryScan:start", {
            reason: "manual",
            paths: [...paths],
        });
        if (showSummary && result.started && !result.cancelled) {
            await dialogUtils.confirm({
                title: t("library.importFinishedTitle"),
                message: t("library.importFinishedMessage", {
                    added: result.added,
                    skipped: result.skipped,
                    failed: result.failed,
                }),
                noOption: true,
                type: "info",
            });
        }
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

    const confirmThenScan = async (paths: readonly string[]): Promise<void> => {
        const { response } = await dialogUtils.warn({
            title: t("library.importTitle"),
            message: t("library.importMessage"),
            noOption: false,
            buttons: [t("shared.cancel"), t("library.importBtn")],
            defaultId: 0,
        });
        if (!response) return;
        await runScan(paths, true);
    };

    /**
     * Unions this root's folder tags onto catalogue items already under the root
     * (excluding foreign extra-folder trees). Confirms when more than one item.
     */
    const handleBackfill = async (
        rootPath: string,
        tagIds: readonly number[],
        target: "default" | number,
    ): Promise<void> => {
        const known = new Set(tagCatalog.map((tag) => tag.id));
        const ids = keepKnownLibraryFolderTagIds(tagIds, known);
        if (ids.length === 0) return;
        const skipRoots = listForeignLibraryScanSkipPaths(rootPath, folders);
        const links = libraryItemLinksUnderScanRoot(Object.keys(libraryItems), rootPath, skipRoots);
        if (links.length === 0) {
            dialogUtils.customError({ message: t("library.backfillNone") });
            return;
        }
        const ok = await confirmWhenMany({
            count: links.length,
            title: t("library.backfillTitle"),
            message: t("library.backfillMessage", { count: links.length }),
            cancelLabel: tCommon("actions.cancel"),
            confirmLabel: t("library.backfillTags"),
        });
        if (!ok) return;
        setBackfillTarget(target);
        setBackfillFeedback("saving");
        try {
            const result = await dispatch(unionLibraryItemTags({ itemLinks: links, tagIds: ids })).unwrap();
            setBackfillFeedback(result.rows ? "saved" : "failed");
        } catch (e) {
            log.error("folder tag backfill failed", { rootPath, count: links.length }, e);
            setBackfillFeedback("failed");
        }
        window.setTimeout(() => {
            setBackfillFeedback("idle");
            setBackfillTarget(null);
        }, BACKFILL_FEEDBACK_RESTORE_MS);
    };

    const patchFolder = (match: (folder: LibraryFolder) => boolean, patch: Partial<LibraryFolder>): void => {
        persistFolders(patchLibraryFolder(store.getState().mainSettings.library.folders, match, patch));
    };

    const handleChangeDefaultPath = (): void => {
        promptSelectDir((selected) => {
            const folderPath = Array.isArray(selected) ? selected[0] : selected;
            if (!folderPath) return;
            const latest = store.getState().mainSettings.library.folders;
            const others = extraLibraryFolders(latest);
            if (isDuplicateLibraryFolderPath(others, folderPath)) {
                dialogUtils.customError({ message: t("library.folderAlreadyAdded") });
                return;
            }
            persistFolders(setDefaultLocationPath(latest, folderPath));
        });
    };

    const handleAddFolder = (): void => {
        promptSelectDir((selected) => {
            const folderPath = Array.isArray(selected) ? selected[0] : selected;
            if (!folderPath) return;
            const latest = store.getState().mainSettings.library.folders;
            if (isDuplicateLibraryFolderPath(latest, folderPath)) {
                dialogUtils.customError({ message: t("library.folderAlreadyAdded") });
                return;
            }
            persistFolders([...latest, newLibraryFolderSetting(folderPath)]);
            dispatch(setAppSettings({ libraryFoldersListExpanded: true }));
        });
    };

    const handleRemoveFolder = async (index: number): Promise<void> => {
        const folder = extras[index];
        if (!folder || folder.isDefaultLocation) return;
        const { response } = await dialogUtils.warn({
            title: t("library.removeFolderTitle"),
            message: t("library.removeFolderMessage", { path: folder.path }),
            noOption: false,
            buttons: [t("shared.cancel"), t("shared.remove")],
            defaultId: 0,
        });
        if (!response) return;
        persistFolders(folders.filter((row) => row !== folder));
    };

    const handleScanThisFolder = (folder: LibraryFolder): void => {
        const root = getExistingBaseDir(folder.path);
        if (!root) {
            dialogUtils.customError({
                message: folder.isDefaultLocation ? t("library.setDefaultFirst") : t("library.folderMissing"),
            });
            return;
        }
        void confirmThenScan([root]);
    };

    /**
     * Confirm before turning Watch on. Unchecking does not ask. Cancel leaves
     * the setting off so a mis-click cannot start a live tree watcher.
     */
    const confirmEnableWatch = async (): Promise<boolean> => {
        const { response } = await dialogUtils.warn({
            title: t("library.watchConfirmTitle"),
            message: t("library.watchConfirmMessage"),
            detail: t("library.watchConfirmDetail"),
            noOption: false,
            buttons: [t("shared.cancel"), t("library.watchConfirmEnable")],
            defaultId: 0,
        });
        return Boolean(response);
    };

    const handleClearUnusedProgress = async (): Promise<void> => {
        const links = unusedDummyProgressLinks(libraryItems);
        if (links.length === 0) {
            await dialogUtils.confirm({
                title: t("library.clearUnusedProgressTitle"),
                message: t("library.clearUnusedProgressNone"),
                noOption: true,
                type: "info",
            });
            return;
        }
        const { response } = await dialogUtils.warn({
            title: t("library.clearUnusedProgressTitle"),
            message: t("library.clearUnusedProgressMessage", { count: links.length }),
            detail: t("library.clearUnusedProgressDetail"),
            noOption: false,
            buttons: [t("shared.cancel"), t("library.clearUnusedProgress")],
            defaultId: 0,
        });
        if (!response) return;
        await runBusy("clearProgress", t("library.clearUnusedProgressError"), async () => {
            const res = await dispatch(deleteProgressForLinks({ links })).unwrap();
            setClearProgressLabel(t("library.clearedUnused", { count: res.deleted }));
            window.setTimeout(() => setClearProgressLabel(""), 2000);
        });
    };

    const disabled = busy !== null;
    // start/interval walks share the in-flight lock; keep Scan now from stacking on them
    const scanDisabled = disabled || libraryScanBusy;
    const scanBusyLabel = libraryScanBusy ? t("library.importing", { label: "" }) : t("library.scanNow");
    const scanThisLabel = libraryScanBusy ? t("library.importing", { label: "" }) : t("library.scanThisFolder");

    const renderFolderControls = (
        folder: LibraryFolder,
        match: (row: LibraryFolder) => boolean,
        opts: { skipInputId: string; tagsId: string; backfillKey: "default" | number },
    ) => (
        <>
            <div className="col libraryFolderControls">
                <div className="row libraryFolderRow">
                    <InputSelect
                        labeled
                        value={folder.content}
                        disabled={disabled}
                        className="noBG"
                        labelBefore={t("library.contentLabel")}
                        onChange={(value) => {
                            if (isLibraryFolderContent(value)) patchFolder(match, { content: value });
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
                        tooltip={t("library.maxDepthWarn")}
                        timeout={[
                            500,
                            (value) => {
                                patchFolder(match, { maxDepth: clampLibraryScanMaxDepth(value) });
                            },
                        ]}
                    />
                    <InputNumber
                        value={folder.scanIntervalMinutes}
                        min={0}
                        step={1}
                        integerOnly
                        disabled={disabled}
                        className="noBG"
                        labelBefore={t("library.intervalMinutes")}
                        tooltip={t("library.intervalMinutesHint")}
                        timeout={[
                            500,
                            (value) => {
                                patchFolder(match, { scanIntervalMinutes: Math.max(0, Math.trunc(value)) });
                            },
                        ]}
                    />
                </div>
                <LibraryScanRootOptions
                    skipPattern={folder.skipPattern}
                    tagIds={folder.tagIds}
                    skipInputId={opts.skipInputId}
                    tagsId={opts.tagsId}
                    disabled={disabled}
                    onSkipPatternChange={(value) => {
                        patchFolder(match, { skipPattern: value });
                    }}
                    onTagIdsChange={(ids) => {
                        patchFolder(match, { tagIds: ids });
                    }}
                    onBackfill={() => {
                        const rootPath = getExistingBaseDir(folder.path);
                        if (!rootPath) {
                            dialogUtils.customError({
                                message: folder.isDefaultLocation
                                    ? t("library.setDefaultFirst")
                                    : t("library.folderMissing"),
                            });
                            return;
                        }
                        void handleBackfill(rootPath, folder.tagIds, opts.backfillKey);
                    }}
                    backfillBusy={backfillTarget === opts.backfillKey}
                    backfillFeedback={backfillTarget === opts.backfillKey ? backfillFeedback : "idle"}
                />

                <div className="row libraryFolderRow">
                    <InputCheckbox
                        checked={folder.scanOnStart}
                        className="noBG"
                        disabled={disabled}
                        onChange={(e) => {
                            patchFolder(match, { scanOnStart: e.currentTarget.checked });
                        }}
                        labelAfter={t("library.scanOnStart")}
                    />
                    <InputCheckbox
                        checked={folder.watch}
                        className="noBG"
                        disabled={disabled}
                        onChange={(e) => {
                            if (!e.currentTarget.checked) {
                                patchFolder(match, { watch: false });
                                return;
                            }
                            void confirmEnableWatch().then((ok) => {
                                if (ok) patchFolder(match, { watch: true });
                            });
                        }}
                        labelAfter={t("library.watch")}
                    />
                </div>
            </div>
        </>
    );

    return (
        <div className="settingItem2" id="settings-library">
            <h3>{t("library.title")}</h3>
            <div className="desc">{t("library.intro")}</div>

            <div className="row" id="settings-library-section-toggle">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                        dispatch(
                            setAppSettings({ librarySettingsExpanded: !appSettings.librarySettingsExpanded }),
                        );
                    }}
                >
                    {appSettings.librarySettingsExpanded
                        ? t("library.collapseSection")
                        : t("library.expandSection")}
                </button>
            </div>

            {appSettings.librarySettingsExpanded && (
                <>
                    <div className="main col" id="settings-default-location">
                        <h4>{t("defaultLocation.title")}</h4>
                        <div className="desc">{t("defaultLocation.desc")}</div>
                        <div className="row libraryFolderRow">
                            <span className="libraryFolderPathLabel">{t("library.folderPath")}</span>
                            <input type="text" value={defaultFolder.path} readOnly title={defaultFolder.path} />
                            <button type="button" disabled={disabled} onClick={handleChangeDefaultPath}>
                                {t("defaultLocation.changeDefault")}
                            </button>
                            <button
                                type="button"
                                disabled={scanDisabled}
                                onClick={() => handleScanThisFolder(defaultFolder)}
                            >
                                {scanThisLabel}
                            </button>
                        </div>
                        {renderFolderControls(defaultFolder, (row) => row.isDefaultLocation, {
                            skipInputId: "settings-default-location-skip",
                            tagsId: "settings-default-location-tags",
                            backfillKey: "default",
                        })}
                    </div>

                    <div className="main col" id="settings-library-folders">
                        <h4>{t("library.foldersTitle")}</h4>
                        <div className="desc">{t("library.foldersDesc")}</div>
                        <div className="desc">{t("library.watchDesc")}</div>
                        <div className="row">
                            <button type="button" disabled={disabled} onClick={handleAddFolder}>
                                {t("library.addFolder")}
                            </button>
                            <button
                                type="button"
                                id="settings-library-folders-list-toggle"
                                disabled={disabled || extras.length === 0}
                                onClick={() => {
                                    dispatch(
                                        setAppSettings({
                                            libraryFoldersListExpanded: !appSettings.libraryFoldersListExpanded,
                                        }),
                                    );
                                }}
                            >
                                {appSettings.libraryFoldersListExpanded
                                    ? t("library.hideFolders")
                                    : t("library.showFolders", { count: extras.length })}
                            </button>
                        </div>
                        {appSettings.libraryFoldersListExpanded &&
                            extras.map((folder, index) => (
                                <div key={`${folder.path}-${index}`} className="col libraryFolderCard">
                                    <div className="row libraryFolderRow">
                                        <span className="libraryFolderPathLabel">{t("library.folderPath")}</span>
                                        <input type="text" value={folder.path} readOnly title={folder.path} />
                                        <button
                                            type="button"
                                            disabled={scanDisabled}
                                            onClick={() => handleScanThisFolder(folder)}
                                        >
                                            {scanThisLabel}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => void handleRemoveFolder(index)}
                                        >
                                            {t("shared.remove")}
                                        </button>
                                    </div>
                                    {renderFolderControls(
                                        folder,
                                        (row) => row.path === folder.path && !row.isDefaultLocation,
                                        {
                                            skipInputId: `settings-library-folder-skip-${index}`,
                                            tagsId: `settings-library-folder-tags-${index}`,
                                            backfillKey: index,
                                        },
                                    )}
                                </div>
                            ))}
                    </div>

                    <div className="main col" id="settings-library-scan-now">
                        <h4>{t("library.scanNow")}</h4>
                        <div className="desc">
                            {t("library.scanDescBefore")}
                            <code>.epub</code>
                            {t("library.scanDescAfter")}
                        </div>
                        <div className="desc">{t("library.scanNowDesc")}</div>
                        <div className="row">
                            <button
                                type="button"
                                disabled={scanDisabled}
                                onClick={() => {
                                    const paths = existingLibraryFolderPaths(folders);
                                    if (paths.length === 0) {
                                        dialogUtils.customError({ message: t("library.scanNoRoots") });
                                        return;
                                    }
                                    void confirmThenScan(paths);
                                }}
                            >
                                {scanBusyLabel}
                            </button>
                        </div>
                    </div>

                    <div className="main col" id="settings-library-clear-unused-progress">
                        <h4>{t("library.clearUnusedProgress")}</h4>
                        <div className="desc">{t("library.clearUnusedProgressDesc")}</div>
                        <div className="row">
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => void handleClearUnusedProgress()}
                            >
                                {busy === "clearProgress"
                                    ? t("library.clearingUnused")
                                    : clearProgressLabel || t("library.clearUnusedProgress")}
                            </button>
                        </div>
                    </div>

                    <div className="main col">
                        <h4>{t("library.thumbnails")}</h4>
                        <div className="desc">
                            {t("library.thumbnailsDescBefore")}
                            <code>covers</code>
                            {t("library.thumbnailsDescAfter")}
                        </div>
                        <div className="desc">{t("library.clearRegenDesc")}</div>
                        <div className="row">
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
                </>
            )}
        </div>
    );
};

export default LibrarySettings;
