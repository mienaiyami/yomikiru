import { useDirectoryValidator } from "@features/reader/hooks/useDirectoryValidator";
import { setAppSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import store from "@store/index";
import { deleteProgressForLinks, fetchAllItemsWithProgress } from "@store/library";
import { unionLibraryItemTags } from "@store/tags";
import { blockUi, setLibraryScanStatus, UI_BLOCK_ID_LIBRARY, unblockUi } from "@store/ui";
import InputCheckbox from "@ui/InputCheckbox";
import InputNumber from "@ui/InputNumber";
import InputSelect from "@ui/InputSelect";
import { confirmWhenMany, dialogUtils } from "@utils/dialog";
import { promptSelectDir } from "@utils/file";
import { regenerateLibraryThumbnails, showRegenSkippedWarning } from "@utils/libraryCoverService";
import {
    getExistingBaseDir,
    isDuplicateLibraryFolderPath,
    isLibraryFolderContent,
    keepKnownLibraryFolderTagIds,
    type LibraryScanRoot,
    libraryFolderScanRoot,
    libraryItemLinksUnderScanRoot,
    listForeignLibraryScanSkipPaths,
    listManualLibraryScanRoots,
    newLibraryFolderSetting,
    scanLibraryRoots,
    showImportFinishedSummary,
    unusedDummyProgressLinks,
    withLibraryScanTimestamps,
} from "@utils/librarySettingsImport";
import { createRendererLogger } from "@utils/logger";
import { clampLibraryScanMaxDepth, LIBRARY_SCAN_MAX_DEPTH_CEILING } from "@utils/mangaChapters";
import type { LibraryFolderSetting } from "@utils/settingsSchema";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import LibraryScanRootOptions from "./LibraryScanRootOptions";

const log = createRendererLogger("settings/LibrarySettings");

/** How long Saved / Failed stays on the folder-tag backfill button. */
const BACKFILL_FEEDBACK_RESTORE_MS = 1500;

/** Catalog ids under Library that sit inside the collapsible body (not the section heading). */
const LIBRARY_COLLAPSED_NAV_IDS = new Set([
    "setting:default-location",
    "setting:scan-default-location",
    "setting:scan-default-location-depth",
    "setting:scan-default-location-interval",
    "setting:scan-default-location-skip",
    "setting:scan-default-location-tags",
    "setting:library-folders",
    "setting:library-folders-list",
    "setting:library-scan-now",
    "setting:library-clear-unused-progress",
]);

type LibrarySettingsBusy = "clear" | "regen" | "importChildren" | "clearProgress" | null;

/**
 * Settings for how the library finds titles on disk and refreshes cover thumbnails.
 */
const LibrarySettings: React.FC = () => {
    const { t } = useTranslation("settings");
    const { t: tCommon } = useTranslation("common");
    const dispatch = useAppDispatch();
    const appSettings = useAppSelector((s) => s.appSettings);
    const libraryItems = useAppSelector((s) => s.library.items);
    const tagCatalog = useAppSelector((s) => s.tags.catalog);
    const libraryScanStatus = useAppSelector((s) => s.ui.libraryScanStatus);
    const libraryScanBusy = libraryScanStatus != null;
    const pendingSettingsNav = useAppSelector((s) => s.ui.pendingSettingsNav);
    const { validateDirectory } = useDirectoryValidator();

    const [busy, setBusy] = useState<LibrarySettingsBusy>(null);
    const [regenLabel, setRegenLabel] = useState("");
    const [importLabel, setImportLabel] = useState("");
    const [clearProgressLabel, setClearProgressLabel] = useState("");
    const [backfillFeedback, setBackfillFeedback] = useState<"idle" | "saving" | "saved" | "failed">("idle");
    const [backfillTarget, setBackfillTarget] = useState<"default" | number | null>(null);

    useEffect(() => {
        const navId = pendingSettingsNav?.id;
        if (!navId || !LIBRARY_COLLAPSED_NAV_IDS.has(navId)) return;
        const expandFoldersList =
            navId === "setting:library-folders" &&
            appSettings.libraryFolders.length > 0 &&
            !appSettings.libraryFoldersListExpanded;
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
        appSettings.libraryFolders.length,
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

    useEffect(() => {
        if (busy !== "importChildren" || !libraryScanStatus) return;
        const folder = window.path.basename(libraryScanStatus.currentPath || libraryScanStatus.rootPath);
        const label =
            libraryScanStatus.phase === "adding" && libraryScanStatus.addTotal > 0
                ? `${libraryScanStatus.addIndex} / ${libraryScanStatus.addTotal}`
                : folder;
        setImportLabel(label);
        setLibraryBlockMessage(t("library.importing", { label }));
    }, [busy, libraryScanStatus, t, setLibraryBlockMessage]);

    useEffect(() => {
        if (tagCatalog.length === 0) return;
        const known = new Set(tagCatalog.map((tag) => tag.id));
        const nextDefault = keepKnownLibraryFolderTagIds(appSettings.scanDefaultLocationTagIds, known);
        const nextFolders = appSettings.libraryFolders.map((folder) => ({
            ...folder,
            tagIds: keepKnownLibraryFolderTagIds(folder.tagIds, known),
        }));
        const defaultSame =
            nextDefault.length === appSettings.scanDefaultLocationTagIds.length &&
            nextDefault.every((id, i) => id === appSettings.scanDefaultLocationTagIds[i]);
        const foldersSame = nextFolders.every(
            (folder, i) =>
                folder.tagIds.length === (appSettings.libraryFolders[i]?.tagIds.length ?? 0) &&
                folder.tagIds.every((id, j) => id === appSettings.libraryFolders[i]?.tagIds[j]),
        );
        if (defaultSame && foldersSame) return;
        dispatch(
            setAppSettings({
                scanDefaultLocationTagIds: nextDefault,
                libraryFolders: nextFolders,
            }),
        );
    }, [appSettings.libraryFolders, appSettings.scanDefaultLocationTagIds, dispatch, tagCatalog]);

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
                let shouldClearStatus = false;
                try {
                    const { added, skipped, failed, ran } = await scanLibraryRoots(roots, {
                        dispatch,
                        keepExtractedFiles: store.getState().appSettings.keepExtractedFiles,
                        validateDirectory,
                        existingLinks,
                    });
                    shouldClearStatus = ran;
                    if (ran) persistScanTimestamps(roots.map((r) => r.path));
                    await dispatch(fetchAllItemsWithProgress());
                    log.info("library scan", { added, skipped, failed, ran, paths: roots.map((r) => r.path) });
                    if (showSummary && ran) await showImportFinishedSummary(added, skipped, failed);
                } catch (e) {
                    shouldClearStatus = true;
                    throw e;
                } finally {
                    if (shouldClearStatus) dispatch(setLibraryScanStatus(null));
                }
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
        const skipRoots = listForeignLibraryScanSkipPaths(rootPath, appSettings);
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
                    libraryFoldersListExpanded: true,
                }),
            );
        });
    };

    const handleRemoveFolder = async (index: number): Promise<void> => {
        const folder = appSettings.libraryFolders[index];
        if (!folder) return;
        const { response } = await dialogUtils.warn({
            title: t("library.removeFolderTitle"),
            message: t("library.removeFolderMessage", { path: folder.path }),
            noOption: false,
            buttons: [t("shared.cancel"), t("shared.remove")],
            defaultId: 0,
        });
        if (!response) return;
        dispatch(
            setAppSettings({
                libraryFolders: appSettings.libraryFolders.filter((_, i) => i !== index),
            }),
        );
    };

    const handleScanThisFolder = (folder: LibraryFolderSetting): void => {
        const root = libraryFolderScanRoot(folder);
        if (!root) {
            dialogUtils.customError({ message: t("library.folderMissing") });
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
    const scanBusyLabel =
        busy === "importChildren" ? t("library.importing", { label: importLabel }) : t("library.scanNow");
    const scanThisLabel =
        busy === "importChildren" ? t("library.importing", { label: importLabel }) : t("library.scanThisFolder");

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
                        <div className="row">
                            <input type="text" value={appSettings.baseDir} readOnly />
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                    promptSelectDir((path) =>
                                        dispatch(setAppSettings({ baseDir: path as string })),
                                    );
                                }}
                            >
                                {t("defaultLocation.changeDefault")}
                            </button>
                        </div>
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

                    <div className="main col libraryScanDefaultLocation">
                        <div id="settings-scan-default-location-depth">
                            <div className="row">
                                <InputNumber
                                    value={appSettings.scanDefaultLocationMaxDepth}
                                    min={0}
                                    max={LIBRARY_SCAN_MAX_DEPTH_CEILING}
                                    step={1}
                                    integerOnly
                                    disabled={disabled || !appSettings.scanDefaultLocation}
                                    className="noBG"
                                    labelBefore={t("library.scanDefaultLocationMaxDepth")}
                                    timeout={[
                                        500,
                                        (value) => {
                                            dispatch(
                                                setAppSettings({
                                                    scanDefaultLocationMaxDepth: clampLibraryScanMaxDepth(value),
                                                }),
                                            );
                                        },
                                    ]}
                                />
                            </div>
                            <div className="desc">{t("library.scanDefaultLocationMaxDepthWarn")}</div>
                        </div>

                        <div id="settings-scan-default-location-interval">
                            <div className="row">
                                <InputNumber
                                    value={appSettings.scanDefaultLocationIntervalMinutes}
                                    min={0}
                                    step={1}
                                    integerOnly
                                    disabled={disabled || !appSettings.scanDefaultLocation}
                                    className="noBG"
                                    labelBefore={t("library.scanDefaultLocationInterval")}
                                    labelAfter={t("library.minutesUnit")}
                                    timeout={[
                                        500,
                                        (value) => {
                                            dispatch(
                                                setAppSettings({
                                                    scanDefaultLocationIntervalMinutes: Math.max(
                                                        0,
                                                        Math.trunc(value),
                                                    ),
                                                }),
                                            );
                                        },
                                    ]}
                                />
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
                                            {
                                                path: baseDir,
                                                content: "both",
                                                maxDepth: clampLibraryScanMaxDepth(
                                                    appSettings.scanDefaultLocationMaxDepth,
                                                ),
                                                skipPattern: appSettings.scanDefaultLocationSkipPattern,
                                                tagIds: appSettings.scanDefaultLocationTagIds,
                                            },
                                        ]);
                                    }}
                                >
                                    {scanThisLabel}
                                </button>
                            </div>
                            <div className="desc">{t("library.intervalMinutesHint")}</div>
                        </div>

                        <LibraryScanRootOptions
                            skipPattern={appSettings.scanDefaultLocationSkipPattern}
                            tagIds={appSettings.scanDefaultLocationTagIds}
                            skipInputId="settings-scan-default-location-skip"
                            tagsId="settings-scan-default-location-tags"
                            disabled={disabled || !appSettings.scanDefaultLocation}
                            onSkipPatternChange={(value) => {
                                dispatch(setAppSettings({ scanDefaultLocationSkipPattern: value }));
                            }}
                            onTagIdsChange={(ids) => {
                                dispatch(setAppSettings({ scanDefaultLocationTagIds: ids }));
                            }}
                            onBackfill={() => {
                                const baseDir = getExistingBaseDir(appSettings.baseDir);
                                if (!baseDir) {
                                    dialogUtils.customError({ message: t("library.setDefaultFirst") });
                                    return;
                                }
                                void handleBackfill(baseDir, appSettings.scanDefaultLocationTagIds, "default");
                            }}
                            backfillBusy={backfillTarget === "default"}
                            backfillFeedback={backfillTarget === "default" ? backfillFeedback : "idle"}
                        />
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
                                disabled={disabled || appSettings.libraryFolders.length === 0}
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
                                    : t("library.showFolders", { count: appSettings.libraryFolders.length })}
                            </button>
                        </div>
                        {appSettings.libraryFoldersListExpanded &&
                            appSettings.libraryFolders.map((folder, index) => (
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
                                    <div className="row libraryFolderRow">
                                        <InputSelect
                                            labeled
                                            value={folder.content}
                                            disabled={disabled}
                                            className="noBG"
                                            labelBefore={t("library.contentLabel")}
                                            onChange={(value) => {
                                                if (isLibraryFolderContent(value))
                                                    patchFolder(index, { content: value });
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
                                                        maxDepth: clampLibraryScanMaxDepth(value),
                                                    });
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
                                            timeout={[
                                                500,
                                                (value) => {
                                                    patchFolder(index, {
                                                        scanIntervalMinutes: Math.max(0, Math.trunc(value)),
                                                    });
                                                },
                                            ]}
                                        />
                                        <InputCheckbox
                                            checked={folder.scanOnStart}
                                            className="noBG"
                                            disabled={disabled}
                                            onChange={(e) => {
                                                patchFolder(index, { scanOnStart: e.currentTarget.checked });
                                            }}
                                            labelAfter={t("library.scanOnStart")}
                                        />
                                        <InputCheckbox
                                            checked={folder.watch}
                                            className="noBG"
                                            disabled={disabled}
                                            onChange={(e) => {
                                                if (!e.currentTarget.checked) {
                                                    patchFolder(index, { watch: false });
                                                    return;
                                                }
                                                void confirmEnableWatch().then((ok) => {
                                                    if (ok) patchFolder(index, { watch: true });
                                                });
                                            }}
                                            labelAfter={t("library.watch")}
                                        />
                                    </div>
                                    <LibraryScanRootOptions
                                        skipPattern={folder.skipPattern}
                                        tagIds={folder.tagIds}
                                        skipInputId={`settings-library-folder-skip-${index}`}
                                        tagsId={`settings-library-folder-tags-${index}`}
                                        disabled={disabled}
                                        onSkipPatternChange={(value) => {
                                            patchFolder(index, { skipPattern: value });
                                        }}
                                        onTagIdsChange={(ids) => {
                                            patchFolder(index, { tagIds: ids });
                                        }}
                                        onBackfill={() => {
                                            void handleBackfill(folder.path, folder.tagIds, index);
                                        }}
                                        backfillBusy={backfillTarget === index}
                                        backfillFeedback={backfillTarget === index ? backfillFeedback : "idle"}
                                    />
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
