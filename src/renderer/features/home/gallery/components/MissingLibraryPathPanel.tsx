import { faFolderOpen, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppDispatch } from "@store/hooks";
import { dialogUtils } from "@utils/dialog";
import {
    confirmDeleteLibraryItem,
    dispatchRelocateLibraryItem,
    pickRelocatedLibraryPath,
} from "@utils/libraryMissingPath";
import { useTranslation } from "react-i18next";

type MissingLibraryPathPanelProps = {
    type: "manga" | "book";
    link: string;
    title: string;
    /** Called with the new library link after a successful relocate. */
    onRelocated: (newLink: string) => void;
    onRemoved: () => void;
};

/**
 * Shown inside gallery details `manga-actions-container` when the library path is
 * missing on disk. Cover, metadata, and bookmark/note lists stay mounted.
 * Offers Locate on disk (DB relocate) or Remove from Library.
 */
const MissingLibraryPathPanel: React.FC<MissingLibraryPathPanelProps> = ({
    type,
    link,
    title,
    onRelocated,
    onRemoved,
}) => {
    const { t } = useTranslation("home");
    const dispatch = useAppDispatch();

    const handleLocate = async () => {
        const newLink = await pickRelocatedLibraryPath({ type, oldLink: link, title });
        if (!newLink) return;
        const item = await dispatchRelocateLibraryItem(dispatch, { oldLink: link, newLink });
        if (!item) {
            await dialogUtils.customError({
                message: t("gallery.missing.relocateFailed"),
            });
            return;
        }
        onRelocated(newLink);
    };

    const handleRemove = () => {
        void confirmDeleteLibraryItem(dispatch, link, onRemoved);
    };

    return (
        <div className="missing-library-path">
            <h2>{t("gallery.missing.title")}</h2>
            <p>{type === "book" ? t("gallery.missing.wasDeletedBook") : t("gallery.missing.wasDeletedManga")}</p>
            <p className="missing-path" title={link}>
                {link}
            </p>
            <p>{t("gallery.missing.locateHint")}</p>
            <div className="missing-actions">
                <button
                    type="button"
                    className="action-button continue-reading"
                    onClick={() => void handleLocate()}
                >
                    <FontAwesomeIcon icon={faFolderOpen} />
                    <span>{t("gallery.missing.locateOnDisk")}</span>
                </button>
                <button type="button" className="action-button select-cover" onClick={handleRemove}>
                    <FontAwesomeIcon icon={faTrash} />
                    <span>{t("shared.removeFromLibrary.title")}</span>
                </button>
            </div>
        </div>
    );
};

export default MissingLibraryPathPanel;
