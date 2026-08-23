import type { LanguageSource } from "@common/i18n";
import { BUILTIN_EN_SOURCE_ID, BUILTIN_SOURCES, isBuiltinSourceId, parsePackSourceId } from "@common/i18n";
import { useAppDispatch } from "@store/hooks";
import { getMainSettings } from "@store/mainSettings";
import InputSelect from "@ui/InputSelect";
import { dialogUtils } from "@utils/dialog";
import { createRendererLogger } from "@utils/logger";
import { type ReactElement, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const log = createRendererLogger("settings/language");

const sourceOptionLabel = (source: LanguageSource): string => `${source.locale} - ${source.name}`;

/**
 * Main-settings Language section: pick a language source, install/export/remove packs.
 * Mounted near the top of {@link GeneralSettings}.
 */
const LanguageSettings = (): ReactElement => {
    const { t } = useTranslation("settings");
    const dispatch = useAppDispatch();
    /* seed builtins so InputSelect has options before i18n:getState resolves */
    const [sources, setSources] = useState<LanguageSource[]>(() => [...BUILTIN_SOURCES]);
    const [sourceId, setSourceId] = useState(BUILTIN_EN_SOURCE_ID);
    const [busy, setBusy] = useState(false);

    const refresh = async (): Promise<void> => {
        const state = await window.electron.invoke("i18n:getState");
        setSources(state.sources);
        setSourceId(state.sourceId);
        void dispatch(getMainSettings());
    };

    useEffect(() => {
        void window.electron.invoke("i18n:getState").then((state) => {
            setSources(state.sources);
            setSourceId(state.sourceId);
        });
        return window.electron.on("i18n:changed", (payload) => {
            setSourceId(payload.sourceId);
            void window.electron.invoke("i18n:listSources").then(setSources);
        });
    }, []);

    const onSelectSource = async (nextId: string): Promise<void> => {
        if (nextId === sourceId || busy) return;
        setBusy(true);
        try {
            const state = await window.electron.invoke("i18n:setSource", { sourceId: nextId });
            setSourceId(state.sourceId);
            setSources(state.sources);
            void dispatch(getMainSettings());
        } catch (err) {
            log.error("failed to set language source", err);
        } finally {
            setBusy(false);
        }
    };

    const onInstall = async (): Promise<void> => {
        const result = await dialogUtils.showOpenDialog({
            properties: ["openFile"],
            filters: [{ name: "Translation pack", extensions: ["zip"] }],
        });
        if (result.canceled || !result.filePaths[0]) return;
        setBusy(true);
        try {
            const installed = await window.electron.invoke("i18n:installPack", {
                archivePath: result.filePaths[0],
            });
            if (!installed.ok) {
                await dialogUtils.customError({
                    message: t("language.installFailed"),
                    detail: installed.message,
                });
                return;
            }
            await refresh();
            await dialogUtils.confirm({
                title: t("language.title"),
                message: t("language.installSuccess"),
                noOption: true,
                type: "info",
            });
        } finally {
            setBusy(false);
        }
    };

    const onExport = async (): Promise<void> => {
        const result = await dialogUtils.showSaveDialog({
            defaultPath: `${sourceId.replace(":", "-")}.zip`,
            filters: [{ name: "Translation pack", extensions: ["zip"] }],
        });
        if (result.canceled || !result.filePath) return;
        setBusy(true);
        try {
            const exported = await window.electron.invoke("i18n:exportPack", {
                sourceId,
                destinationPath: result.filePath,
            });
            if (!exported.ok) {
                await dialogUtils.customError({
                    message: t("language.exportFailed"),
                    detail: exported.message,
                });
                return;
            }
            await dialogUtils.confirm({
                title: t("language.title"),
                message: t("language.exportSuccess"),
                noOption: true,
                type: "info",
            });
        } finally {
            setBusy(false);
        }
    };

    const onRemove = async (): Promise<void> => {
        const packId = parsePackSourceId(sourceId);
        if (!packId) {
            await dialogUtils.warn({
                message: t("language.builtinCannotRemove"),
                noOption: true,
            });
            return;
        }
        const confirm = await dialogUtils.confirm({
            message: t("language.removeConfirm"),
            noOption: false,
        });
        if (confirm.response !== 0) return;
        setBusy(true);
        try {
            const removed = await window.electron.invoke("i18n:removePack", { packId });
            if (!removed.ok) {
                await dialogUtils.customError({
                    message: t("language.removeFailed"),
                    detail: removed.message,
                });
                return;
            }
            await refresh();
        } finally {
            setBusy(false);
        }
    };

    const isBuiltin = isBuiltinSourceId(sourceId);

    return (
        <div className="settingItem2" id="settings-language">
            <h3>{t("language.title")}</h3>
            <div className="desc">{t("language.description")}</div>
            <div className="main col" style={{ gap: "0.5rem" }}>
                <InputSelect
                    labeled
                    labelBefore={t("language.sourceLabel")}
                    value={sourceId}
                    disabled={busy}
                    onChange={(value) => {
                        void onSelectSource(value);
                    }}
                    options={sources.map((s) => ({
                        label: sourceOptionLabel(s),
                        value: s.id,
                    }))}
                />
                <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                    <button type="button" disabled={busy} onClick={() => void onInstall()}>
                        {t("language.installPack")}
                    </button>
                    <button type="button" disabled={busy} onClick={() => void onExport()}>
                        {t("language.exportPack")}
                    </button>
                    <button type="button" disabled={busy || isBuiltin} onClick={() => void onRemove()}>
                        {t("language.removePack")}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LanguageSettings;
