import { BookNote } from "@common/types/db";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { getReaderBook } from "@store/reader";
import { addNote, removeNote, updateNote } from "@store/bookNotes";
import dateUtils from "@utils/date";
import { dialogUtils } from "@utils/dialog";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { shallowEqual } from "react-redux";
import { useAppContext } from "src/renderer/App";
import ListItem from "src/renderer/components/ListItem";
import ListNavigator from "src/renderer/components/ListNavigator";
import Modal from "src/renderer/components/ui/Modal";
import InputColor from "@ui/InputColor";
import { colorUtils } from "@utils/color";
import { highlightUtils } from "@utils/highlight";

const COLORS = [
    "#FFEB3B",
    // "#FFC107",
    // "#FF9800",
    "#FF5722",
    "#03A9F4",
    // "#2196F3",
    "#4CAF50",
    "#8BC34A",
    "#9C27B0",
    "#E91E63",
];

const NoteModal: React.FC<{
    noteId: number;
    clear: () => void;
}> = memo(({ noteId, clear }) => {
    const bookInReader = useAppSelector(getReaderBook);
    const dispatch = useAppDispatch();
    const note = useAppSelector((store) =>
        store.bookNotes.book[bookInReader?.link || ""]?.find((n) => n.id === noteId),
    );
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [color, setColor] = useState(colorUtils.new(note?.color || "yellow"));

    useEffect(() => {
        if (noteId) {
            inputRef.current?.select();
        }
    }, [noteId]);

    if (!bookInReader) {
        clear();
        console.error(`bookInReader is undefined for noteId: ${noteId}`);
        dialogUtils.customError({
            message: "Unknown error",
        });
        return null;
    }

    if (!note) {
        clear();
        dialogUtils.customError({
            message: "Note not found",
        });
        return null;
    }

    return (
        <Modal open onClose={clear} className="note-modal">
            <h3>Edit Note</h3>

            <p className="selected-text">{note.selectedText}</p>

            <div className="note-input">
                <h4>Note:</h4>
                <textarea
                    ref={inputRef}
                    defaultValue={note.content || ""}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                    }}
                    placeholder="Enter your notes"
                />
                <InputColor
                    value={color}
                    onChange={(color) => {
                        setColor(color);
                    }}
                    title="Color"
                    showAlpha={false}
                />
            </div>

            <div className="modal-actions">
                <button onClick={clear}>Cancel</button>
                <button
                    onClick={() => {
                        if (!inputRef.current) return;
                        dispatch(
                            updateNote({
                                id: note.id,
                                content: inputRef.current.value,
                                color: color.hexa(),
                            }),
                        );
                        clear();
                    }}
                >
                    Save
                </button>
            </div>
        </Modal>
    );
});
NoteModal.displayName = "NoteModal";

const NotesList: React.FC<{
    openChapterById: (chapterId: string, position?: string) => void;
}> = ({ openChapterById }) => {
    const { setContextMenuData } = useAppContext();
    const dispatch = useAppDispatch();
    const bookInReader = useAppSelector(getReaderBook);
    const [editNoteId, setEditNoteId] = useState<number | null>(null);
    // const [newNoteText, setNewNoteText] = useState("");

    const notesArray: BookNote[] = useAppSelector(
        (store) =>
            [...((bookInReader && store.bookNotes.book[bookInReader.link]) || [])].sort(
                (b, a) => a.createdAt.getTime() - b.createdAt.getTime(),
            ),
        shallowEqual,
    );

    const handleAddNote = useCallback(
        (color: string) => {
            const epubReader = document.querySelector("#EPubReader");
            if (!epubReader || !bookInReader?.progress?.chapterId) return;

            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) {
                dialogUtils.customError({
                    message: "Please select some text first",
                });
                return;
            }

            const range = highlightUtils.getCurrentSelection();
            if (!range) {
                dialogUtils.customError({
                    message: "Could not get selection range",
                });
                return;
            }

            const text = selection.toString();
            selection.removeAllRanges();
            try {
                color = colorUtils.new(color).hexa();
            } catch (err) {
                console.error(err);
                color = COLORS[0];
            }
            dispatch(
                addNote({
                    itemLink: bookInReader.link,
                    chapterId: bookInReader.progress.chapterId,
                    chapterName: bookInReader.progress.chapterName,
                    range,
                    selectedText: text,
                    color,
                }),
            );
        },
        [bookInReader, dispatch],
    );

    const handleNoteClick = useCallback(
        (e: React.MouseEvent<HTMLAnchorElement>) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                const noteId = Number(e.currentTarget.getAttribute("data-note-id"));
                if (isNaN(noteId)) throw new Error("Invalid note id");

                const note = notesArray.find((n) => n.id === noteId);
                if (!note) throw new Error("Note not found");
                openChapterById(note.chapterId, `[data-highlight-id="${noteId}"]`);
            } catch (error) {
                console.error(error);
                dialogUtils.customError({
                    message: "Could not find the note",
                });
            }
        },
        [notesArray, openChapterById],
    );

    const handleNoteContextMenu = useCallback(
        (e: React.MouseEvent<HTMLAnchorElement>) => {
            e.preventDefault();
            e.stopPropagation();
            const noteId = Number(e.currentTarget.getAttribute("data-note-id"));
            if (isNaN(noteId)) return;

            const note = notesArray.find((n) => n.id === noteId);
            if (!note) {
                dialogUtils.customError({
                    message: "Could not find the note",
                });
                return;
            }

            const items: Menu.ListItem[] = [
                {
                    label: "Edit Note",
                    action() {
                        if (!bookInReader) return;
                        setEditNoteId(note.id);
                    },
                },
                {
                    label: "Delete Note",
                    action() {
                        if (!bookInReader) return;
                        dispatch(removeNote({ itemLink: bookInReader.link, ids: [note.id] }));
                    },
                },
            ];

            setContextMenuData({
                clickX: e.clientX,
                clickY: e.clientY,
                focusBackElem: e.nativeEvent.relatedTarget,
                items,
            });
        },
        [notesArray, setContextMenuData, bookInReader],
    );

    const renderNoteItem = useCallback(
        (note: BookNote, index: number, isSelected: boolean) => {
            return (
                <ListItem
                    focused={isSelected}
                    title={note.content || note.selectedText}
                    key={note.id}
                    onClick={handleNoteClick}
                    onContextMenu={handleNoteContextMenu}
                    dataAttributes={{
                        "data-note-id": note.id.toString(),
                    }}
                    classNameAnchor="note-item"
                >
                    <span className="highlight-color" style={{ backgroundColor: note.color }}></span>
                    <div>
                        <span className="text">{note.chapterName}</span>
                        {note.content && <span className="text">Note: {note.content}</span>}
                        <span
                            className={note.content === "" ? "text" : "note-selected-text"}
                            title={note.selectedText}
                        >
                            {note.selectedText}
                        </span>
                        <span className="date" title={note.createdAt.toString()}>
                            {dateUtils.format(note.createdAt, {
                                format: dateUtils.presets.dateTime,
                            })}
                        </span>
                    </div>
                </ListItem>
            );
        },
        [handleNoteClick, handleNoteContextMenu],
    );

    return (
        <>
            <div className="actions">
                {/* <input
                    type="text"
                    placeholder="Add Note"
                    className="add-note-input"
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                /> */}
                <div className="color-buttons">
                    {COLORS.map((color) => (
                        <button
                            key={color}
                            onClick={() => handleAddNote(color)}
                            style={{ "--highlight-color": color }}
                        ></button>
                    ))}
                </div>
            </div>
            <div className="location-cont">
                <ListNavigator.Provider items={notesArray} renderItem={renderNoteItem} emptyMessage="No Notes">
                    <ListNavigator.List />
                </ListNavigator.Provider>

                {editNoteId && <NoteModal noteId={editNoteId} clear={() => setEditNoteId(null)} />}
            </div>
        </>
    );
};

export default NotesList;
