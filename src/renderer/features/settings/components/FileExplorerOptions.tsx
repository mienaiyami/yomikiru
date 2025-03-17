import { ReactElement, useState } from "react";
import InputCheckbox from "@ui/InputCheckbox";
import { useExplorerOptions } from "../hooks/useExplorerOptions";

const FileExplorerOptions = (): ReactElement => {
    const [openInSameWindow, setOpenInSameWindow] = useState(
        window.fs.existsSync(
            window.path.join(window.electron.app.getPath("userData"), "OPEN_IN_EXISTING_WINDOW"),
        ) || false,
    );
    const { isUpdating, handleInvoke } = useExplorerOptions();

    const handleOpenInSameWindowChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        //todo handle it in electron
        const fileName = window.path.join(window.electron.app.getPath("userData"), "OPEN_IN_EXISTING_WINDOW");
        if (!e.currentTarget.checked) {
            if (window.fs.existsSync(fileName)) window.fs.rm(fileName);
        } else {
            window.fs.writeFile(fileName, " ");
        }
        setOpenInSameWindow((init) => !init);
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
                    checked={openInSameWindow}
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
