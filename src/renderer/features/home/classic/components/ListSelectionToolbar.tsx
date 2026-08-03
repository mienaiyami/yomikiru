import { faCheck, faEllipsisV, faSort, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppContext } from "@renderer/App";

/** Props for {@link ListSelectionToolbar}. */
export type ListSelectionToolbarProps = {
    /** Number of currently selected items. */
    count: number;
    /** Replace the selection with all visible items. */
    onSelectAll: () => void;
    /** Invert the selection across visible items. */
    onInvertSelection: () => void;
    /** Cancel selection and exit selection mode. */
    onCancel: () => void;
    /** Tab-specific bulk actions surfaced under the 3-dot menu. */
    extraMenuItems?: Menu.ListItem[];
};

/**
 * Compact selection toolbar reused by classic-view list tabs (bookmarks,
 * history). Renders inside the existing `.tools` row above the list.
 */
const ListSelectionToolbar: React.FC<ListSelectionToolbarProps> = ({
    count,
    onSelectAll,
    onInvertSelection,
    onCancel,
    extraMenuItems,
}) => {
    const { setContextMenuData } = useAppContext();

    const handleMore = (e: React.MouseEvent) => {
        const items: Menu.ListItem[] = [
            ...(extraMenuItems ?? []),
            ...(extraMenuItems?.length ? [window.contextMenu.template.divider()] : []),
            { label: "Invert Selection", action: onInvertSelection },
            { label: "Clear Selection", action: onCancel },
        ];
        setContextMenuData({
            clickX: e.currentTarget.getBoundingClientRect().x,
            clickY: e.currentTarget.getBoundingClientRect().bottom + 4,
            padLeft: true,
            items,
            focusBackElem: e.currentTarget,
        });
    };

    return (
        <div className="listSelectionToolbar">
            <button data-tooltip="Cancel selection" onClick={onCancel} className="listSelectionCancel">
                <FontAwesomeIcon icon={faTimes} />
            </button>
            <span className="listSelectionCount">{count} selected</span>
            <span className="spacer" />
            <button data-tooltip="Select All" onClick={onSelectAll}>
                <FontAwesomeIcon icon={faCheck} />
            </button>
            <button data-tooltip="Invert Selection" onClick={onInvertSelection}>
                <FontAwesomeIcon icon={faSort} rotation={90} />
            </button>
            <button data-tooltip="More" onClick={handleMore}>
                <FontAwesomeIcon icon={faEllipsisV} />
            </button>
        </div>
    );
};

export default ListSelectionToolbar;
