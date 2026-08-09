import { faFolderOpen, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppDispatch } from "@store/hooks";
import { dialogUtils } from "@utils/dialog";
import {
    confirmDeleteLibraryItem,
    dispatchRelocateLibraryItem,
    LOCATE_ON_DISK_LABEL,
    pickRelocatedLibraryPath,
} from "@utils/libraryMissingPath";

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
    const dispatch = useAppDispatch();

    const handleLocate = async () => {
        const newLink = await pickRelocatedLibraryPath({ type, oldLink: link, title });
        if (!newLink) return;
        const item = await dispatchRelocateLibraryItem(dispatch, { oldLink: link, newLink });
        if (!item) {
            await dialogUtils.customError({
                message: "Could not update library path. The new location may already be in the library.",
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
            <h2>Missing from disk</h2>
            <p>This {type === "book" ? "EPUB" : "manga folder or file"} was deleted or moved.</p>
            <p className="missing-path" title={link}>
                {link}
            </p>
            <p>Locate it on disk to keep progress and bookmarks, or remove the library entry.</p>
            <div className="missing-actions">
                <button
                    type="button"
                    className="action-button continue-reading"
                    onClick={() => void handleLocate()}
                >
                    <FontAwesomeIcon icon={faFolderOpen} />
                    <span>{LOCATE_ON_DISK_LABEL}</span>
                </button>
                <button type="button" className="action-button select-cover" onClick={handleRemove}>
                    <FontAwesomeIcon icon={faTrash} />
                    <span>Remove from Library</span>
                </button>
            </div>
        </div>
    );
};

export default MissingLibraryPathPanel;
