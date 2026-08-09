import { setAppSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { updateMainSettings } from "@store/mainSettings";
import InputCheckbox from "@ui/InputCheckbox";
import { dialogUtils } from "@utils/dialog";
import { promptSelectDir } from "@utils/file";
import { createRendererLogger } from "@utils/logger";
import { useTranslation } from "react-i18next";

const log = createRendererLogger("settings/CustomTempLocation");

const CustomTempLocation: React.FC = () => {
    const { t } = useTranslation("settings");
    const { t: tCommon } = useTranslation("common");
    const dispatch = useAppDispatch();
    const appSettings = useAppSelector((state) => state.appSettings);
    const { tempPath } = useAppSelector((state) => state.mainSettings);

    const updateTempPath = async (newPath?: string) => {
        try {
            if (newPath === undefined || window.fs.existsSync(newPath)) {
                dispatch(updateMainSettings({ tempPath: newPath }));
            } else {
                throw new Error(`Folder does not exist : ${newPath}`);
            }
        } catch (reason) {
            log.error("temp path update failed (IPC)", reason);
        }
    };

    return (
        <div className="settingItem2" id="settings-customTempFolder">
            <h3>{t("tempFolder.title")}</h3>
            <div className="desc">
                {t("tempFolder.desc1")}
                <br />
                {t("tempFolder.desc2")}
            </div>
            <div className="main row">
                <input type="text" placeholder={t("tempFolder.placeholder")} value={tempPath} readOnly />
                <button
                    onClick={() => {
                        promptSelectDir((path) => {
                            updateTempPath(path as string);
                        });
                    }}
                >
                    {t("shared.select")}
                </button>
            </div>
            <div className="main row">
                <button
                    onClick={() => {
                        updateTempPath();
                    }}
                >
                    {t("tempFolder.useDefault")}
                </button>
                <button
                    onClick={async (e) => {
                        try {
                            const target = e.currentTarget;
                            target.disabled = true;
                            const res = await dialogUtils.confirm({
                                message: t("tempFolder.clearConfirm"),
                                checkboxLabel: t("tempFolder.alsoClearCache"),
                                buttons: [tCommon("actions.yes"), tCommon("actions.no")],
                                cancelId: 1,
                                defaultId: 1,
                                type: "question",
                            });

                            setTimeout(() => {
                                target.disabled = false;
                            }, 6000);
                            if (res.response === 0) {
                                if (res.checkboxChecked) {
                                    window.electron.clearAppCache();
                                }
                                const files = await window.fs.readdir(tempPath);
                                files
                                    .filter((e) => e.startsWith("yomikiru"))
                                    .forEach(
                                        (e) =>
                                            void window.fs.rm(window.path.join(tempPath, e), {
                                                force: true,
                                                recursive: true,
                                            }),
                                    );
                            }
                        } catch (err) {
                            log.error("cache folder delete failed", err);
                        }
                    }}
                >
                    {t("tempFolder.deleteCache")}
                </button>
            </div>
            <div className="toggleItem" id="settings-keepExtractedFiles">
                <InputCheckbox
                    checked={appSettings.keepExtractedFiles}
                    className="noBG"
                    onChange={(e) => {
                        dispatch(
                            setAppSettings({
                                keepExtractedFiles: e.currentTarget.checked,
                            }),
                        );
                    }}
                    labelAfter={t("tempFolder.keepTempFiles")}
                />
                <div className="desc">
                    {t("tempFolder.keepDesc1")}
                    <br />
                    {t("tempFolder.keepDesc2")}
                </div>
            </div>
        </div>
    );
};

export default CustomTempLocation;
