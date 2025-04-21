import { useState } from "react";
import { dialogUtils } from "@utils/dialog";
import { promptSelectDir } from "@utils/file";
import InputCheckbox from "@ui/InputCheckbox";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { setAppSettings } from "@store/appSettings";

const CustomTempLocation: React.FC = () => {
    const dispatch = useAppDispatch();
    const appSettings = useAppSelector((state) => state.appSettings);
    const [tempFolder, setTempFolder] = useState(window.electron.app.getPath("temp"));

    const updateTempPath = async (newPath?: string) => {
        try {
            if (newPath === undefined || window.fs.existsSync(newPath)) {
                const newSettings = await window.electron.invoke("mainSettings:update", { tempPath: newPath });
                setTempFolder(newSettings.tempPath);
            } else {
                throw new Error("Folder does not exist : " + newPath);
            }
        } catch (reason) {
            window.logger.error("Unable to change temp path.", reason);
        }
    };

    return (
        <div className="settingItem2" id="settings-customTempFolder">
            <h3>Custom Temp Folder</h3>
            <div className="desc">
                Folder where app will extract archives or epub or render pdf. It can have big effect on extracting
                speed depending on type of drive (ssd, faster drives) or storage left (10GB+ recommended).
                <br /> Defaults to temp folder provided by OS.
            </div>
            <div className="main row">
                <input type="text" placeholder="No path Selected" value={tempFolder} readOnly />
                <button
                    onClick={() => {
                        promptSelectDir((path) => {
                            updateTempPath(path as string);
                        });
                    }}
                >
                    Select
                </button>
            </div>
            <div className="main row">
                <button
                    onClick={() => {
                        updateTempPath();
                    }}
                >
                    Use Default
                </button>
                <button
                    onClick={async (e) => {
                        try {
                            const target = e.currentTarget;
                            target.disabled = true;
                            const res = await dialogUtils.confirm({
                                message: "Clear all extracted/rendered files?",
                                checkboxLabel: "Also clear app's cache.",
                                buttons: ["Yes", "No"],
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
                                const files = await window.fs.readdir(tempFolder);
                                files
                                    .filter((e) => e.startsWith("yomikiru"))
                                    .forEach((e) =>
                                        window.fs.rm(window.path.join(tempFolder, e), {
                                            force: true,
                                            recursive: true,
                                        }),
                                    );
                            }
                        } catch (err) {
                            window.logger.error(err);
                        }
                    }}
                >
                    Delete all File Cache
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
                    labelAfter="Keep Temp Files"
                />
                <div className="desc">
                    Keep temporary files, mainly extracted archives, pdf and epub. Skip extracting part when
                    opening same title again. <br />
                    NOTE: If temp folder is set to default then there is a possibility that your system might
                    delete those files after each power on.
                </div>
            </div>
        </div>
    );
};

export default CustomTempLocation;
