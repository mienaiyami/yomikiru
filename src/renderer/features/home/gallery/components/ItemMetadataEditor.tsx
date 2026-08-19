import type { LibraryItemMetadata } from "@common/types/db";
import { useAppDispatch } from "@store/hooks";
import { setLibraryItemMetadata } from "@store/library";
import Modal from "@ui/Modal";
import { formatGenreList, parseGenreList } from "@utils/libraryMetadata";
import { appRootElement } from "@utils/utils";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

type ItemMetadataEditorProps = {
    itemLink: string;
    /** Current user overlay, if any. Empty fields fall through on save. */
    userOverlay?: LibraryItemMetadata;
    onClose: () => void;
};

type SavePhase = "idle" | "saving" | "saved" | "failed";

/** How long Saving / Saved / Failed stays on the overlay save button. Success then calls {@link ItemMetadataEditorProps.onClose}. */
const SAVE_FEEDBACK_MS = 1500;

/** Stable control ids so each stacked field label can point at its input. */
const FIELD_IDS = {
    title: "item-metadata-editor-title",
    author: "item-metadata-editor-author",
    description: "item-metadata-editor-description",
    genres: "item-metadata-editor-genres",
} as const;

/**
 * Overlay editor for the user metadata layer (title, author, description, genres).
 * Save swaps the button label for the IPC outcome, then closes after a successful save.
 */
export const ItemMetadataEditor = ({ itemLink, userOverlay, onClose }: ItemMetadataEditorProps) => {
    const { t } = useTranslation("home");
    const { t: tCommon } = useTranslation("common");
    const dispatch = useAppDispatch();
    const [title, setTitle] = useState(userOverlay?.title ?? "");
    const [author, setAuthor] = useState(userOverlay?.author ?? "");
    const [description, setDescription] = useState(userOverlay?.description ?? "");
    const [genres, setGenres] = useState(formatGenreList(userOverlay?.genres ?? []));
    const [savePhase, setSavePhase] = useState<SavePhase>("idle");
    const feedbackTimerRef = useRef(0);

    useEffect(() => () => window.clearTimeout(feedbackTimerRef.current), []);

    const handleSave = async () => {
        if (savePhase === "saving") return;
        const genreList = parseGenreList(genres);
        setSavePhase("saving");
        try {
            const row = await dispatch(
                setLibraryItemMetadata({
                    itemLink,
                    source: "user",
                    title: title.trim() || null,
                    author: author.trim() || null,
                    description: description.trim() || null,
                    genres: genreList.length > 0 ? genreList : null,
                }),
            ).unwrap();
            if (row) {
                setSavePhase("saved");
                feedbackTimerRef.current = window.setTimeout(() => onClose(), SAVE_FEEDBACK_MS);
                return;
            }
            setSavePhase("failed");
        } catch {
            setSavePhase("failed");
        }
        feedbackTimerRef.current = window.setTimeout(() => setSavePhase("idle"), SAVE_FEEDBACK_MS);
    };

    const saveLabel =
        savePhase === "saving"
            ? tCommon("actions.saving")
            : savePhase === "saved"
              ? tCommon("actions.saved")
              : savePhase === "failed"
                ? tCommon("actions.failed")
                : tCommon("actions.save");

    /* details meta containment clips position:fixed; host on #app without changing Modal */
    return createPortal(
        <Modal open onClose={onClose} className="item-metadata-editor">
            <h3>{t("gallery.details.editMetadata")}</h3>
            <div className="item-metadata-editor-field">
                <label htmlFor={FIELD_IDS.title}>{t("gallery.details.metadataTitle")}</label>
                <input
                    id={FIELD_IDS.title}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.currentTarget.value)}
                />
            </div>
            <div className="item-metadata-editor-field">
                <label htmlFor={FIELD_IDS.author}>{t("gallery.details.metadataAuthor")}</label>
                <input
                    id={FIELD_IDS.author}
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.currentTarget.value)}
                />
            </div>
            <div className="item-metadata-editor-field">
                <label htmlFor={FIELD_IDS.description}>{t("gallery.details.metadataDescription")}</label>
                <textarea
                    id={FIELD_IDS.description}
                    value={description}
                    onChange={(e) => setDescription(e.currentTarget.value)}
                    rows={5}
                />
            </div>
            <div className="item-metadata-editor-field">
                <label htmlFor={FIELD_IDS.genres}>{t("gallery.details.metadataGenres")}</label>
                <input
                    id={FIELD_IDS.genres}
                    type="text"
                    value={genres}
                    onChange={(e) => setGenres(e.currentTarget.value)}
                    placeholder={t("gallery.details.metadataGenresHint")}
                />
            </div>
            <div className="modal-actions">
                <button type="button" onClick={onClose}>
                    {tCommon("actions.cancel")}
                </button>
                <button type="button" onClick={() => void handleSave()} disabled={savePhase === "saving"}>
                    {saveLabel}
                </button>
            </div>
        </Modal>,
        appRootElement(),
    );
};
