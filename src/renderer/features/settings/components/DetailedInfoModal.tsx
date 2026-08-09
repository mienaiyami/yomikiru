import { useAppSelector } from "@store/hooks";
import TextDisplayModal from "@ui/TextDisplayModal";
import type { TFunction } from "i18next";
import { memo } from "react";
import { useTranslation } from "react-i18next";

type DetailedInfoModalProps = {
    open: boolean;
    onClose: () => void;
};

/**
 * Formats detailed build info for display and copy, matching Cursor-style About dialog.
 */
const formatBuildInfo = (channel: string | undefined, t: TFunction<"settings">): string => {
    const p = window.process;
    const app = window.electron.app;
    const versions = p.versions;
    const platformDisplay = p.platform === "win32" ? "Windows_NT" : p.platform;
    const releaseTrack = channel === "beta" ? t("detailedInfo.trackBeta") : t("detailedInfo.trackDefault");
    const unknown = t("detailedInfo.unknown");

    return [
        `${t("detailedInfo.version")}${app.getVersion()}`,
        `${t("detailedInfo.productName")}${app.getName()}`,
        `${t("detailedInfo.commit")}${p.buildCommit ?? unknown}`,
        `${t("detailedInfo.date")}${p.buildDate ?? unknown}`,
        `${t("detailedInfo.buildType")}${p.buildType ?? "development"}`,
        `${t("detailedInfo.releaseTrack")}${releaseTrack}`,
        `${t("detailedInfo.electron")}${versions.electron ?? unknown}`,
        `${t("detailedInfo.chromium")}${versions.chrome ?? unknown}`,
        `${t("detailedInfo.nodejs")}${versions.node ?? unknown}`,
        `${t("detailedInfo.v8")}${versions.v8 ?? unknown}`,
        `${t("detailedInfo.os")}${platformDisplay} ${p.arch} ${p.osRelease ?? ""}`,
    ].join("\n");
};

const DetailedInfoModal = memo(({ open, onClose }: DetailedInfoModalProps) => {
    const { t } = useTranslation("settings");
    const { t: tCommon } = useTranslation("common");
    const mainSettings = useAppSelector((state) => state.mainSettings);
    const text = formatBuildInfo(mainSettings?.channel, t);

    return (
        <TextDisplayModal
            open={open}
            title={window.electron.app.getName()}
            text={text}
            onClose={onClose}
            buttons={[
                {
                    label: t("detailedInfo.copy"),
                    onClick: () => {
                        window.electron.writeText(text);
                        onClose();
                    },
                },
                {
                    label: tCommon("actions.ok"),
                    onClick: onClose,
                },
            ]}
        />
    );
});

DetailedInfoModal.displayName = "DetailedInfoModal";

export default DetailedInfoModal;
