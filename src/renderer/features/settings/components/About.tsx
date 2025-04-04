import InputCheckbox from "@ui/InputCheckbox";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { setAppSettings } from "@store/appSettings";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { faHeart } from "@fortawesome/free-solid-svg-icons";
import { AppUpdateChannel } from "@common/types/ipc";
import InputSelect from "@ui/InputSelect";

const About: React.FC = () => {
    const appSettings = useAppSelector((store) => store.appSettings);
    const dispatch = useAppDispatch();

    const handleChannelChange = async (newChannel: AppUpdateChannel) => {
        if (newChannel === "beta") {
            const result = await window.electron.invoke("dialog:confirm", {
                title: "Warning: Beta Channel",
                message: "Are you sure you want to switch to beta channel?",
                detail: "Beta releases may be unstable and could contain bugs. Use at your own risk.",
                buttons: ["Switch to Beta", "Cancel"],
                cancelId: 1,
            });
            if (result.response === 1) return;
        } else {
            window.electron.invoke("dialog:confirm", {
                message: "You will only receive update after stable version crosses your current version.",
            });
        }
        dispatch(setAppSettings({ ...appSettings, updateChannel: newChannel }));
    };
    return (
        <div className="content2">
            <div className="settingItem2">
                <h3>Version</h3>
                <div
                    className="desc"
                    style={{
                        userSelect: "text",
                    }}
                >
                    {window.electron.app.getVersion()}
                    {" | "}
                    {process.arch === "x64" ? "64-bit" : "32-bit"}
                </div>
                <div className="main col">
                    <InputCheckbox
                        className="noBG"
                        paraAfter="Check for updates every 1 hour"
                        checked={appSettings.updateCheckerEnabled}
                        onChange={(e) => {
                            dispatch(
                                setAppSettings({
                                    updateCheckerEnabled: e.currentTarget.checked,
                                }),
                            );
                        }}
                    />
                    <InputCheckbox
                        checked={appSettings.skipMinorUpdate}
                        className="noBG"
                        onChange={(e) => {
                            dispatch(
                                setAppSettings({
                                    skipMinorUpdate: e.currentTarget.checked,
                                }),
                            );
                        }}
                        title="Mostly just frequent updates rather than minor."
                        paraAfter="Skip minor updates"
                    />
                    <InputCheckbox
                        checked={appSettings.autoDownloadUpdate}
                        className="noBG"
                        onChange={(e) => {
                            dispatch(
                                setAppSettings({
                                    autoDownloadUpdate: e.currentTarget.checked,
                                }),
                            );
                        }}
                        paraAfter="Auto download updates"
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
                        Check for Update Now
                    </button>
                    <button
                        onClick={() =>
                            window.electron.openExternal("https://github.com/mienaiyami/yomikiru/releases")
                        }
                    >
                        Changelogs
                    </button>
                    <InputSelect
                        options={["stable", "beta"].map((e) => ({
                            label: e,
                            value: e,
                        }))}
                        onChange={(e) => handleChannelChange(e as AppUpdateChannel)}
                        value={appSettings.updateChannel}
                        labeled={true}
                        labelBefore="Update Channel"
                    />
                </div>
            </div>
            <div className="settingItem2">
                <h3>Others</h3>
                {/* <div className="desc"></div> */}
                <div className="main col">
                    <button
                        onClick={() => window.electron.openExternal("https://github.com/mienaiyami/yomikiru/")}
                    >
                        <FontAwesomeIcon icon={faGithub} /> Home Page
                    </button>
                    <button
                        onClick={() =>
                            window.electron.openExternal(
                                "https://github.com/mienaiyami/yomikiru/discussions/categories/announcements",
                            )
                        }
                    >
                        <FontAwesomeIcon icon={faGithub} /> Announcements
                    </button>
                    <button
                        onClick={() =>
                            window.electron.openExternal("https://github.com/mienaiyami/yomikiru/issues")
                        }
                    >
                        <FontAwesomeIcon icon={faGithub} /> Submit Issue, Feature Request, Ask Question
                    </button>
                    <button
                        onClick={() => window.electron.openExternal("https://github.com/sponsors/mienaiyami")}
                        style={{
                            gap: "4px",
                        }}
                    >
                        <FontAwesomeIcon icon={faHeart} />
                        Support
                    </button>
                </div>
                <hr className="mini" />
                <div className="main col">
                    <button
                        onClick={(e) => {
                            const target = e.currentTarget;
                            target.innerText = "\u00a0".repeat(16) + "Copied!" + "\u00a0".repeat(16);
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
                        Show Local Logs
                    </button>
                </div>
            </div>
        </div>
    );
};

export default About;
