import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useExplorerOptions } from "../hooks/useExplorerOptions";

const FileExplorerOptions = (): ReactElement => {
    const { t } = useTranslation("settings");
    const { isUpdating, handleInvoke } = useExplorerOptions();

    const handleAddOption = () => {
        handleInvoke("explorer:addOption", t("fileExplorer.addedManga"));
    };

    const handleRemoveOption = () => {
        handleInvoke("explorer:removeOption", t("fileExplorer.removedManga"));
    };

    const handleAddEpubOption = () => {
        handleInvoke("explorer:addOption:epub", t("fileExplorer.addedEpub"));
    };

    const handleRemoveEpubOption = () => {
        handleInvoke("explorer:removeOption:epub", t("fileExplorer.removedEpub"));
    };

    return (
        <div className="settingItem2" id="settings-fileExplorerOption">
            <h3>{t("fileExplorer.title")}</h3>
            <div className="desc">{t("fileExplorer.desc")}</div>
            <ul>
                <li>
                    <div className="desc">
                        {t("fileExplorer.mangaDescBefore")}
                        <code>.zip/.cbz</code>, <code>.7z/.cb7</code>, <code>.rar/.cbr</code>, <code>.pdf</code>
                        {t("fileExplorer.mangaDescAfter")}
                    </div>
                    <div className="main row">
                        <button onClick={handleAddOption} disabled={isUpdating}>
                            {t("shared.add")}
                        </button>
                        <button onClick={handleRemoveOption} disabled={isUpdating}>
                            {t("shared.remove")}
                        </button>
                    </div>
                </li>
                <li>
                    <div className="desc">
                        {t("fileExplorer.epubDescBefore")}
                        <code>.epub</code>, <code>.txt</code>, <code>.html/.xhtml</code>
                        {t("fileExplorer.epubDescAfter")}
                    </div>
                    <div className="main row">
                        <button onClick={handleAddEpubOption} disabled={isUpdating}>
                            {t("shared.add")}
                        </button>
                        <button onClick={handleRemoveEpubOption} disabled={isUpdating}>
                            {t("shared.remove")}
                        </button>
                    </div>
                </li>
            </ul>
        </div>
    );
};

export default FileExplorerOptions;
