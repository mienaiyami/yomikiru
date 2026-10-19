import type { LibraryItemMetadata } from "@common/types/db";
import { useAppDispatch } from "@store/hooks";
import { setLibraryItemMetadata } from "@store/library";
import Modal from "@ui/Modal";
import { dialogUtils } from "@utils/dialog";
import { formatGenreList, parseGenreList } from "@utils/libraryMetadata";
import { appRootElement } from "@utils/utils";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

type ItemMetadataEditorProps = {
    itemLink: string;
    /** Current user overlay, if any. Empty fields fall through on save. */
    userOverlay?: LibraryItemMetadata;
    onClose: () => void;
};

type SavePhase = "idle" | "saving" | "saved" | "failed";

/** How long Saving / Saved / Failed stays on the overlay save or reset button. Success then calls {@link ItemMetadataEditorProps.onClose}. */
const SAVE_FEEDBACK_MS = 1500;

/** Stable control ids so each stacked field label can point at its input. */
const FIELD_IDS = {
    title: "item-metadata-editor-title",
    author: "item-metadata-editor-author",
    description: "item-metadata-editor-description",
    genres: "item-metadata-editor-genres",
} as const;

/** True when the stored user overlay has at least one non-empty display field. */
const overlayHasEdits = (row: LibraryItemMetadata | undefined): boolean =>
    Boolean(
        row &&
            ((row.title && row.title.trim()) ||
                (row.author && row.author.trim()) ||
                (row.description && row.description.trim()) ||
                (row.genres && row.genres.length > 0)),
    );

/**
 * Overlay editor for the user metadata layer (title, author, description, genres).
 * Save and Reset swap the button label for the IPC outcome, then close after success.
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
    const [resetPhase, setResetPhase] = useState<SavePhase>("idle");
    const feedbackTimerRef = useRef(0);

    useEffect(() => () => window.clearTimeout(feedbackTimerRef.current), []);

    const formHasValues = Boolean(
        title.trim() || author.trim() || description.trim() || parseGenreList(genres).length,
    );
    const canReset = overlayHasEdits(userOverlay) || formHasValues;
    const busy = savePhase === "saving" || resetPhase === "saving";

    const handleSave = async () => {
        if (busy) return;
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

    const handleReset = async () => {
        if (busy || !canReset) return;
        const { response } = await dialogUtils.confirm({
            title: t("gallery.details.metadataResetTitle"),
            message: t("gallery.details.metadataResetMessage"),
            noOption: false,
            type: "warning",
        });
        if (response !== 0) return;
        /* no stored overlay fields: clearing the form is enough */
        if (!overlayHasEdits(userOverlay)) {
            setTitle("");
            setAuthor("");
            setDescription("");
            setGenres("");
            onClose();
            return;
        }
        setResetPhase("saving");
        try {
            const row = await dispatch(
                setLibraryItemMetadata({
                    itemLink,
                    source: "user",
                    title: null,
                    author: null,
                    description: null,
                    genres: null,
                }),
            ).unwrap();
            if (row) {
                setTitle("");
                setAuthor("");
                setDescription("");
                setGenres("");
                setResetPhase("saved");
                feedbackTimerRef.current = window.setTimeout(() => onClose(), SAVE_FEEDBACK_MS);
                return;
            }
            setResetPhase("failed");
        } catch {
            setResetPhase("failed");
        }
        feedbackTimerRef.current = window.setTimeout(() => setResetPhase("idle"), SAVE_FEEDBACK_MS);
    };

    const saveLabel =
        savePhase === "saving"
            ? tCommon("actions.saving")
            : savePhase === "saved"
              ? tCommon("actions.saved")
              : savePhase === "failed"
                ? tCommon("actions.failed")
                : tCommon("actions.save");

    const resetLabel =
        resetPhase === "saving"
            ? tCommon("actions.resetting")
            : resetPhase === "saved"
              ? tCommon("actions.saved")
              : resetPhase === "failed"
                ? tCommon("actions.failed")
                : tCommon("actions.reset");

    // window shortcuts must not see typed keys (same as ItemTagsPicker fields)
    const stopModalKeys = (e: KeyboardEvent) => {
        e.stopPropagation();
    };

    /* details meta containment clips position:fixed; host on #app without changing Modal */
    return createPortal(
        <Modal open onClose={onClose} className="item-metadata-editor">
            <h3>{t("gallery.details.editMetadata")}</h3>
            <p className="item-metadata-editor-hint">{t("gallery.details.metadataAnilistHint")}</p>
            <div className="item-metadata-editor-field">
                <label htmlFor={FIELD_IDS.title}>{t("gallery.details.metadataTitle")}</label>
                <input
                    id={FIELD_IDS.title}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.currentTarget.value)}
                    onKeyDown={stopModalKeys}
                />
            </div>
            <div className="item-metadata-editor-field">
                <label htmlFor={FIELD_IDS.author}>{t("gallery.details.metadataAuthor")}</label>
                <input
                    id={FIELD_IDS.author}
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.currentTarget.value)}
                    onKeyDown={stopModalKeys}
                />
            </div>
            <div className="item-metadata-editor-field">
                <label htmlFor={FIELD_IDS.description}>{t("gallery.details.metadataDescription")}</label>
                <textarea
                    id={FIELD_IDS.description}
                    value={description}
                    onChange={(e) => setDescription(e.currentTarget.value)}
                    onKeyDown={stopModalKeys}
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
                    onKeyDown={stopModalKeys}
                    placeholder={t("gallery.details.metadataGenresHint")}
                />
            </div>
            <div className="modal-actions">
                <button
                    type="button"
                    className="item-metadata-editor-reset"
                    onClick={() => void handleReset()}
                    disabled={busy || !canReset}
                >
                    {resetLabel}
                </button>
                <button type="button" onClick={onClose} disabled={busy}>
                    {tCommon("actions.cancel")}
                </button>
                <button type="button" onClick={() => void handleSave()} disabled={busy}>
                    {saveLabel}
                </button>
            </div>
        </Modal>,
        appRootElement(),
    );
};
