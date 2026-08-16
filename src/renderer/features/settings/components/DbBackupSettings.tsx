import type { DbBackupImportErrorCode, DbBackupListItem, DbBackupRestoreErrorCode } from "@common/types/ipc";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { updateMainSettings } from "@store/mainSettings";
import InputCheckbox from "@ui/InputCheckbox";
import InputNumber from "@ui/InputNumber";
import { dialogUtils } from "@utils/dialog";
import { formatByteSize } from "@utils/file";
import { createRendererLogger } from "@utils/logger";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { navigateToSetting } from "../utils/navigateToSetting";

const log = createRendererLogger("settings/DbBackupSettings");

/** Matches Zod `dbBackup.intervalHours` (`.int().min(1)`). */
const INTERVAL_HOURS_MIN = 1;
/** Matches Zod `dbBackup.keepCount` (`.int().min(1).max(100)`). */
const KEEP_COUNT_MIN = 1;
const KEEP_COUNT_MAX = 100;

/**
 * Library DB backup controls: enable, interval, keep count, Backup now, optional list + Restore.
 * Mounted in {@link GeneralSettings} above the reset / danger zone.
 */
const DbBackupSettings: React.FC = () => {
    const { t } = useTranslation("settings");
    const { t: tCommon } = useTranslation("common");
    const dispatch = useAppDispatch();
    const dbBackup = useAppSelector((s) => s.mainSettings.dbBackup);
    const [items, setItems] = useState<DbBackupListItem[]>([]);
    const [busy, setBusy] = useState(false);
    const [listOpen, setListOpen] = useState(false);

    const refreshList = async () => {
        try {
            setItems(await window.electron.invoke("dbBackup:list"));
        } catch (err) {
            log.error("list backups failed", err);
        }
    };

    /**
     * Runs a restore/import that relaunches on success; clears busy only on failure.
     */
    const queueRelaunchAction = async (
        work: () => Promise<{ ok: boolean }>,
        failLogMessage: string,
    ): Promise<void> => {
        setBusy(true);
        try {
            const res = await work();
            if (!res.ok) {
                setBusy(false);
            }
            /* on success the app relaunches; leave busy if quit is slow */
        } catch (err) {
            log.error(failLogMessage, err);
            dialogUtils.customError({ message: t("dbBackup.restoreQueueFailed") });
            setBusy(false);
        }
    };

    const restoreErrorMessage = (code: DbBackupRestoreErrorCode): string => {
        if (code === "invalidName") return t("dbBackup.invalidName");
        if (code === "notFound") return t("dbBackup.notFound");
        return t("dbBackup.restoreQueueFailed");
    };

    const showImportError = (code: DbBackupImportErrorCode, reason?: string): void => {
        if (code === "integrityFailed") {
            dialogUtils.customError({
                message: t("dbBackup.importIntegrityFailed"),
                detail: reason,
            });
            return;
        }
        if (code === "copyFailed") {
            dialogUtils.customError({ message: t("dbBackup.importCopyFailed") });
            return;
        }
        dialogUtils.customError({ message: t("dbBackup.notFound") });
    };

    const handleBackupNow = async () => {
        setBusy(true);
        try {
            const res = await window.electron.invoke("dbBackup:runNow");
            if (!res.ok) {
                dialogUtils.customError({ message: t("dbBackup.backupFailed") });
            }
            if (listOpen) await refreshList();
        } catch (err) {
            log.error("backup now failed", err);
            dialogUtils.customError({ message: t("dbBackup.backupFailed") });
        } finally {
            setBusy(false);
        }
    };

    const handleToggleList = async () => {
        if (listOpen) {
            setListOpen(false);
            return;
        }
        setListOpen(true);
        await refreshList();
    };

    const handleShowInExplorer = (fileName: string) => {
        const filePath = window.path.join(window.electron.app.getPath("userData"), "backups", fileName);
        window.electron.showItemInFolder(filePath);
    };

    const handleRestore = async (fileName: string) => {
        const { response } = await dialogUtils.warn({
            title: t("dbBackup.restoreTitle"),
            message: t("dbBackup.restoreMessage", { fileName }),
            noOption: false,
            buttons: [t("shared.cancel"), t("dbBackup.restore")],
            defaultId: 0,
        });
        if (!response) return;

        await queueRelaunchAction(async () => {
            const res = await window.electron.invoke("dbBackup:restore", { fileName });
            if (!res.ok) {
                dialogUtils.customError({ message: restoreErrorMessage(res.code) });
            }
            return res;
        }, "restore queue failed");
    };

    const handleImportRestore = async () => {
        const pick = await dialogUtils.showOpenDialog({
            properties: ["openFile"],
            filters: [{ name: t("dbBackup.importFilterName"), extensions: ["db"] }],
        });
        if (pick.canceled || !pick.filePaths[0]) return;

        const absolutePath = pick.filePaths[0];
        const { response } = await dialogUtils.warn({
            title: t("dbBackup.importConfirmTitle"),
            message: t("dbBackup.importConfirmMessage", { path: absolutePath }),
            noOption: false,
            buttons: [t("shared.cancel"), t("dbBackup.restore")],
            defaultId: 0,
        });
        if (!response) return;

        await queueRelaunchAction(async () => {
            const res = await window.electron.invoke("dbBackup:importAndRestore", { absolutePath });
            if (!res.ok) {
                showImportError(res.code, res.reason);
            }
            return res;
        }, "import restore failed");
    };

    const lastSuccessLabel =
        dbBackup.lastSuccessAt > 0 ? new Date(dbBackup.lastSuccessAt).toLocaleString() : t("dbBackup.never");

    const sizeUnits = {
        bytes: t("dbBackup.sizeBytes"),
        kb: t("dbBackup.sizeKb"),
        mb: t("dbBackup.sizeMb"),
    };

    return (
        <div className="settingItem2" id="settings-dbBackup">
            <h3>{t("dbBackup.title")}</h3>
            <div className="desc">
                {t("dbBackup.desc")}{" "}
                <a
                    onClick={() => {
                        navigateToSetting("usage:db-backup", dispatch);
                    }}
                >
                    {t("shared.moreInfo")}
                </a>
            </div>
            <div className="toggleItem">
                <InputCheckbox
                    checked={dbBackup.enabled}
                    className="noBG"
                    disabled={busy}
                    onChange={(e) => {
                        void dispatch(
                            updateMainSettings({
                                dbBackup: {
                                    ...dbBackup,
                                    enabled: e.currentTarget.checked,
                                },
                            }),
                        );
                    }}
                    labelAfter={t("dbBackup.enabled")}
                />
            </div>
            <div className="main row">
                <InputNumber
                    value={dbBackup.intervalHours}
                    min={INTERVAL_HOURS_MIN}
                    step={1}
                    disabled={busy}
                    className="noBG"
                    labelBefore={t("dbBackup.intervalLabel")}
                    labelAfter={t("dbBackup.hoursUnit")}
                    timeout={[
                        500,
                        (value) => {
                            void dispatch(
                                updateMainSettings({
                                    dbBackup: {
                                        ...dbBackup,
                                        intervalHours: Math.max(INTERVAL_HOURS_MIN, Math.round(value)),
                                    },
                                }),
                            );
                        },
                    ]}
                />
            </div>
            <div className="main row">
                <InputNumber
                    value={dbBackup.keepCount}
                    min={KEEP_COUNT_MIN}
                    max={KEEP_COUNT_MAX}
                    step={1}
                    disabled={busy}
                    className="noBG"
                    labelBefore={t("dbBackup.keepCountLabel")}
                    labelAfter={t("dbBackup.keepCountUnit")}
                    timeout={[
                        500,
                        (value) => {
                            void dispatch(
                                updateMainSettings({
                                    dbBackup: {
                                        ...dbBackup,
                                        keepCount: Math.min(
                                            KEEP_COUNT_MAX,
                                            Math.max(KEEP_COUNT_MIN, Math.round(value)),
                                        ),
                                    },
                                }),
                            );
                        },
                    ]}
                />
            </div>
            <div className="desc">
                {t("dbBackup.lastSuccess")}: {lastSuccessLabel}
            </div>
            <div className="main row">
                <button type="button" disabled={busy} onClick={() => void handleBackupNow()}>
                    {t("dbBackup.backupNow")}
                </button>
                <button type="button" disabled={busy} onClick={() => void handleImportRestore()}>
                    {t("dbBackup.importRestore")}
                </button>
                <button type="button" disabled={busy} onClick={() => void handleToggleList()}>
                    {listOpen ? t("dbBackup.hideBackups") : t("dbBackup.showBackups")}
                </button>
            </div>
            {listOpen &&
                (items.length === 0 ? (
                    <div className="desc">{t("dbBackup.empty")}</div>
                ) : (
                    items.map((item) => (
                        <div key={item.fileName} className="main row" style={{ alignItems: "center" }}>
                            <span>
                                {new Date(item.createdAtMs).toLocaleString()} (
                                {formatByteSize(item.byteSize, sizeUnits)})
                            </span>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleShowInExplorer(item.fileName)}
                            >
                                {tCommon("contextMenu.showInExplorer")}
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleRestore(item.fileName)}
                            >
                                {t("dbBackup.restore")}
                            </button>
                        </div>
                    ))
                ))}
        </div>
    );
};

export default DbBackupSettings;
