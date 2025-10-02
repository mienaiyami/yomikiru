import { useAppDispatch, useAppSelector } from "@store/hooks";
import { updateMainSettings } from "@store/mainSettings";
import InputCheckbox from "@ui/InputCheckbox";
import type { ReactElement } from "react";
import { useExplorerOptions } from "../hooks/useExplorerOptions";

const FileExplorerOptions = (): ReactElement => {
    const dispatch = useAppDispatch();
    const { openInExistingWindow } = useAppSelector((state) => state.mainSettings);
    const { isUpdating, handleInvoke } = useExplorerOptions();

    const handleOpenInSameWindowChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch(
            updateMainSettings({
                openInExistingWindow: e.currentTarget.checked,
            }),
        );
    };

    const handleAddOption = () => {
        handleInvoke("explorer:addOption", "Explorer option added successfully for manga/image files");
    };

    const handleRemoveOption = () => {
        handleInvoke("explorer:removeOption", "Explorer option removed successfully for manga/image files");
    };

    const handleAddEpubOption = () => {
        handleInvoke("explorer:addOption:epub", "Explorer option added successfully for epub/text files");
    };

    const handleRemoveEpubOption = () => {
        handleInvoke("explorer:removeOption:epub", "Explorer option removed successfully for epub/text files");
    };

    return (
        <div className="settingItem2" id="settings-fileExplorerOption">
            <h3>File Explorer Option</h3>
            <div className="desc">
                Add file explorer option (right click menu) to open item in Yomikiru&apos;s reader directly from
                File Explorer.
            </div>
            <div className="main">
                <InputCheckbox
                    checked={openInExistingWindow}
                    className="noBG"
                    onChange={handleOpenInSameWindowChange}
                    labelAfter="Open In Existing Window"
                />
                <code>App Restart Needed</code>
            </div>
            <ul>
                <li>
                    <div className="desc">
                        For folders, <code>.zip/.cbz</code>, <code>.7z/.cb7</code>, <code>.rar/.cbr</code>,{" "}
                        <code>.pdf</code> (Opened in Manga/Image Reader)
                    </div>
                    <div className="main row">
                        <button onClick={handleAddOption} disabled={isUpdating}>
                            {"Add"}
                        </button>
                        <button onClick={handleRemoveOption} disabled={isUpdating}>
                            {"Remove"}
                        </button>
                    </div>
                </li>
                <li>
                    <div className="desc">
                        For <code>.epub</code>, <code>.txt</code>, <code>.html/.xhtml</code> (Opened in Epub/Text
                        Reader)
                    </div>
                    <div className="main row">
                        <button onClick={handleAddEpubOption} disabled={isUpdating}>
                            {"Add"}
                        </button>
                        <button onClick={handleRemoveEpubOption} disabled={isUpdating}>
                            {"Remove"}
                        </button>
                    </div>
                </li>
            </ul>
        </div>
    );
};

export default FileExplorerOptions;
