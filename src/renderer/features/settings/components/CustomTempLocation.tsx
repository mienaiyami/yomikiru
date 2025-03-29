import { useEffect, useState } from "react";
import { dialogUtils } from "@utils/dialog";
import { promptSelectDir } from "@utils/file";

const CustomTempLocation: React.FC = () => {
    const [tempFolder, setTempFolder] = useState(window.electron.app.getPath("temp"));
    useEffect(() => {
        if (tempFolder !== window.electron.app.getPath("temp"))
            try {
                if (window.fs.existsSync(tempFolder)) {
                    window.electron.invoke("fs:changeTempPath", tempFolder).then(() => {
                        window.logger.log("Temp path changed to", tempFolder);
                    });
                } else throw new Error("Folder does not exist : " + tempFolder);
            } catch (reason) {
                window.logger.error("Unable to change temp path.", reason);
            }
    }, [tempFolder]);
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
                            setTempFolder(path as string);
                        });
                    }}
                >
                    Select
                </button>
            </div>
            <div className="main row">
                <button
                    onClick={() => {
                        if (process.env.TEMP) setTempFolder(process.env.TEMP);
                        else
                            dialogUtils.customError({
                                message: "Unable to get default temp path.",
                            });
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
        </div>
    );
};

export default CustomTempLocation;
