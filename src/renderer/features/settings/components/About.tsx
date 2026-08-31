import type { AppUpdateChannel } from "@common/types/ipc";
import DetailedInfoModal from "@features/settings/components/DetailedInfoModal";
import { faDiscord, faGithub } from "@fortawesome/free-brands-svg-icons";
import { faHeart } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { updateMainSettings } from "@store/mainSettings";
import InputCheckbox from "@ui/InputCheckbox";
import InputSelect from "@ui/InputSelect";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const About: React.FC = () => {
    const { t } = useTranslation("settings");
    const [showDetailedInfo, setShowDetailedInfo] = useState(false);
    const isSettingOpen = useAppSelector((state) => state.ui.isOpen.settings);
    const mainSettings = useAppSelector((state) => state.mainSettings);
    const dispatch = useAppDispatch();

    const handleChannelChange = async (newChannel: AppUpdateChannel) => {
        if (newChannel === "beta") {
            const result = await window.electron.invoke("dialog:confirm", {
                title: t("about.betaWarningTitle"),
                message: t("about.betaWarningMessage"),
                detail: t("about.betaWarningDetail"),
                buttons: [t("about.switchToBeta"), t("shared.cancel")],
                cancelId: 1,
            });
            if (result.response === 1) return;
        } else {
            window.electron.invoke("dialog:confirm", {
                message: t("about.stableOnlyNote"),
            });
        }
        dispatch(updateMainSettings({ channel: newChannel }));
    };

    useEffect(() => {
        if (!isSettingOpen) setShowDetailedInfo(false);
    }, [isSettingOpen]);

    return (
        <div className="content2" id="settings-about">
            <div className="settingItem2">
                <h3>{t("about.version")}</h3>
                <div
                    className="desc"
                    style={{
                        userSelect: "text",
                    }}
                >
                    {window.electron.app.getVersion()}
                    {" | "}
                    {process.arch === "x64" ? t("about.bit64") : t("about.bit32")}
                    {window.process.isPortable ? t("about.portable") : ""}
                </div>
                <div className="main col">
                    <InputCheckbox
                        className="noBG"
                        paraAfter={t("about.checkHourly")}
                        checked={mainSettings?.checkForUpdates ?? false}
                        onChange={(e) => {
                            dispatch(
                                updateMainSettings({
                                    checkForUpdates: e.currentTarget.checked,
                                }),
                            );
                        }}
                    />
                    <InputCheckbox
                        checked={mainSettings?.skipPatch ?? false}
                        className="noBG"
                        onChange={(e) => {
                            dispatch(
                                updateMainSettings({
                                    skipPatch: e.currentTarget.checked,
                                }),
                            );
                        }}
                        title={t("about.betaTitle")}
                        paraAfter={t("about.skipPatch")}
                    />
                    <InputCheckbox
                        checked={mainSettings?.autoDownload ?? false}
                        className="noBG"
                        onChange={(e) => {
                            dispatch(
                                updateMainSettings({
                                    autoDownload: e.currentTarget.checked,
                                }),
                            );
                        }}
                        paraAfter={t("about.autoDownload")}
                    />
                </div>
                <div className="main row">
                    <button
                        onClick={() => {
                            window.electron.send("update:check:manual", {
                                promptAfterCheck: true,
                            });
                        }}
                    >
                        {t("about.checkNow")}
                    </button>
                    <button onClick={() => setShowDetailedInfo(true)}>{t("about.detailedInfo")}</button>
                    <button
                        onClick={() =>
                            window.electron.openExternal("https://github.com/mienaiyami/yomikiru/releases")
                        }
                    >
                        {t("about.changelogs")}
                    </button>
                    <InputSelect
                        options={["stable", "beta"].map((e) => ({
                            label: t(`about.${e}`),
                            value: e,
                        }))}
                        onChange={(e) => handleChannelChange(e as AppUpdateChannel)}
                        value={mainSettings?.channel ?? "stable"}
                        labeled={true}
                        labelBefore={t("about.updateChannel")}
                    />
                </div>
                <DetailedInfoModal open={showDetailedInfo} onClose={() => setShowDetailedInfo(false)} />
            </div>
            <div className="settingItem2">
                <h3>{t("about.others")}</h3>
                {/* <div className="desc"></div> */}
                <div className="main col">
                    <button
                        onClick={() =>
                            window.electron.openExternal("https://github.com/mienaiyami/yomikiru/discussions/495")
                        }
                        style={{ border: "2px solid #5865F2" }}
                    >
                        <FontAwesomeIcon icon={faDiscord} /> {t("about.joinDiscord")}
                    </button>
                    <button
                        onClick={() => window.electron.openExternal("https://github.com/mienaiyami/yomikiru/")}
                    >
                        <FontAwesomeIcon icon={faGithub} /> {t("about.homePage")}
                    </button>
                    <button
                        onClick={() =>
                            window.electron.openExternal(
                                "https://github.com/mienaiyami/yomikiru/discussions/categories/announcements",
                            )
                        }
                    >
                        <FontAwesomeIcon icon={faGithub} /> {t("about.announcements")}
                    </button>
                    <button
                        onClick={() =>
                            window.electron.openExternal("https://github.com/mienaiyami/yomikiru/issues")
                        }
                    >
                        <FontAwesomeIcon icon={faGithub} /> {t("about.submitIssue")}
                    </button>
                    <button
                        onClick={() =>
                            window.electron.openExternal(
                                "https://github.com/mienaiyami/yomikiru/blob/master/PRIVACY.md",
                            )
                        }
                    >
                        <FontAwesomeIcon icon={faGithub} /> {t("about.privacyPolicy")}
                    </button>
                    <button
                        onClick={() => window.electron.openExternal("https://github.com/sponsors/mienaiyami")}
                        style={{
                            gap: "4px",
                            border: "2px solid #eb459e",
                        }}
                    >
                        <FontAwesomeIcon icon={faHeart} />
                        {t("about.support")}
                    </button>
                </div>
                <hr className="mini" />
                <div className="main col">
                    <button
                        onClick={(e) => {
                            const target = e.currentTarget;
                            target.innerText = `${"\u00a0".repeat(16)}${t("shared.copied")}${"\u00a0".repeat(16)}`;
                            window.electron.writeText("mienaiyami0@gmail.com");
                            target.disabled = true;
                            setTimeout(() => {
                                target.disabled = false;
                                target.innerText = "mienaiyami0@gmail.com";
                            }, 3000);
                        }}
                    >
                        mienaiyami0@gmail.com
                    </button>
                    <button
                        onClick={() => {
                            const filePath = window.path.join(
                                window.electron.app.getPath("userData"),
                                "logs/main.log",
                            );
                            if (process.platform === "win32") window.electron.showItemInFolder(filePath);
                            else if (process.platform === "linux")
                                window.electron.invoke("fs:showInExplorer", filePath);
                        }}
                    >
                        {t("about.showLocalLogs")}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default About;
