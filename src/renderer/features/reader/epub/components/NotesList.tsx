import { BookNote } from "@common/types/db";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { getReaderBook } from "@store/reader";
import { addNote, removeNote, updateNote } from "@store/bookNotes";
import dateUtils from "@utils/date";
import { dialogUtils } from "@utils/dialog";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { shallowEqual } from "react-redux";
import { useAppContext } from "src/renderer/App";
import ListItem from "@renderer/components/ListItem";
import ListNavigator from "@renderer/components/ListNavigator";
import Modal from "@ui/Modal";
import InputColor from "@ui/InputColor";
import { colorUtils } from "@utils/color";
import { DEFAULT_HIGHLIGHT_COLORS } from "@utils/highlight";

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
    const [color, setColor] = useState(colorUtils.new(DEFAULT_HIGHLIGHT_COLORS[0]));

    useEffect(() => {
        if (note) {
            try {
                note.color !== "OPEN_EDIT" && setColor(colorUtils.new(note.color));
            } catch (error) {
                console.error(error);
                setColor(colorUtils.new(DEFAULT_HIGHLIGHT_COLORS[0]));
            }
        }
    }, [note]);

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
                <div className="color-buttons">
                    {DEFAULT_HIGHLIGHT_COLORS.map((color) => (
                        <button
                            key={color}
                            onClick={() => setColor(colorUtils.new(color))}
                            style={{ "--highlight-color": color }}
                        ></button>
                    ))}
                </div>
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
    addNote: (color?: string) => void;
    editNoteId: number | null;
    setEditNoteId: (noteId: number | null) => void;
}> = ({ openChapterById, addNote, editNoteId, setEditNoteId }) => {
    const { setContextMenuData } = useAppContext();
    const dispatch = useAppDispatch();
    const bookInReader = useAppSelector(getReaderBook);

    const notesArray: BookNote[] = useAppSelector(
        (store) =>
            [...((bookInReader && store.bookNotes.book[bookInReader.link]) || [])].sort(
                (b, a) => a.createdAt.getTime() - b.createdAt.getTime(),
            ),
        shallowEqual,
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

    useLayoutEffect(() => {
        if (notesArray.length > 0 && notesArray[0].color === "OPEN_EDIT") {
            setEditNoteId(notesArray[0].id);
        }
    }, [notesArray, setEditNoteId]);

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
                    {DEFAULT_HIGHLIGHT_COLORS.map((color) => (
                        <button
                            key={color}
                            onClick={() => addNote(color)}
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
