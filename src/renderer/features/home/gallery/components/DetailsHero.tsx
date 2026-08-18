import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faArrowLeft, faCopy } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { setAppSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Code-only switch for unimplemented About / genres copy in the details hero.
 * Not a user setting. Leave off until a real synopsis source exists.
 */
export const DETAILS_HERO_SYNOPSIS_PREVIEW = false;

/** Auto-sized {@link DetailsMetaBlock} min/max height, in rem (keep in sync with `--details-meta-min-h`). */
export const DETAILS_HERO_HEIGHT_MIN_REM = 40;

/** Floor for a dragged {@link DetailsMetaBlock} height, in CSS pixels. */
export const DETAILS_HERO_RESIZE_MIN_PX = 280;

/** Fraction of the details panel height the metadata block may occupy while dragging. */
export const DETAILS_HERO_HEIGHT_MAX_FRACTION = 0.8;

type DetailsFactFieldProps = {
    label: string;
    children: ReactNode;
};

/**
 * Label + value pair for details hero metadata. Values are selectable (`body` is `user-select: none`).
 */
export const DetailsFactField = ({ label, children }: DetailsFactFieldProps) => (
    <div className="details-field">
        <div className="details-field-label">{label}</div>
        <div className="details-field-value">{children}</div>
    </div>
);

type DetailsTab<T extends string> = {
    id: T;
    label: string;
    icon: IconDefinition;
};

type DetailsTabBarProps<T extends string> = {
    tabs: readonly DetailsTab<T>[];
    activeId: T;
    onChange: (id: T) => void;
    ariaLabel: string;
};

/**
 * Details list switcher using the same `galleryTabBar` / `galleryTab` classes as gallery home.
 */
export const DetailsTabBar = <T extends string>({
    tabs,
    activeId,
    onChange,
    ariaLabel,
}: DetailsTabBarProps<T>) => (
    <nav className="galleryTabBar" aria-label={ariaLabel}>
        {tabs.map((tab) => (
            <button
                key={tab.id}
                type="button"
                className={`galleryTab ${activeId === tab.id ? "active" : ""}`}
                aria-pressed={activeId === tab.id}
                aria-label={tab.label}
                onClick={() => onChange(tab.id)}
            >
                <FontAwesomeIcon icon={tab.icon} className="galleryTabIcon" />
                <span className="galleryTabLabel">{tab.label}</span>
            </button>
        ))}
    </nav>
);

type DetailsListToolbarProps = {
    tabBar: ReactNode;
    /** When set, replaces search and actions (multi-select). */
    selection?: ReactNode;
    search?: ReactNode;
    actions?: ReactNode;
};

/**
 * Details list chrome using the same `galleryToolbar` classes as gallery home
 * (tabs, then `.toolbarEnd` with `.actions` left of `.search`). Do not add `hidden` -
 * that class hides the home toolbar.
 */
export const DetailsListToolbar = ({ tabBar, selection, search, actions }: DetailsListToolbarProps) => (
    <div className="galleryToolbar">
        {tabBar}
        {selection ? (
            <div className="details-selection-slot">{selection}</div>
        ) : (
            <div className="toolbarEnd">
                {actions ? <div className="actions">{actions}</div> : null}
                {search ? <div className="search">{search}</div> : null}
            </div>
        )}
    </div>
);

type DetailsItemNoteProps = {
    value: string;
    onChange: (value: string) => void;
    /** Invoked when leaving edit mode. Persistence may still be unimplemented. */
    onCommit?: () => void;
};

/**
 * Library-item note in the details hero. Click the note body to edit; blur or Escape
 * leaves edit mode (and calls {@link DetailsItemNoteProps.onCommit}).
 */
export const DetailsItemNote = ({ value, onChange, onCommit }: DetailsItemNoteProps) => {
    const { t } = useTranslation("home");
    const [editing, setEditing] = useState(false);
    const editorRef = useRef<HTMLTextAreaElement>(null);
    const placeholder = t("gallery.details.notePlaceholder");

    useEffect(() => {
        if (!editing) return;
        const el = editorRef.current;
        if (!el) return;
        el.focus();
        // grow with text; Electron's Chromium does not support field-sizing
        el.style.height = "0px";
        el.style.height = `${el.scrollHeight}px`;
    }, [editing, value]);

    const enterEdit = () => setEditing(true);

    const leaveEdit = () => {
        setEditing(false);
        onCommit?.();
    };

    const handleEditorKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        e.stopPropagation();
        leaveEdit();
    };

    return (
        <div className={`details-item-note${editing ? " editing" : ""}`}>
            <div className="details-field-label">{t("gallery.details.itemNote")}</div>
            {editing ? (
                <textarea
                    ref={editorRef}
                    className="details-item-note-editor"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={leaveEdit}
                    onKeyDown={handleEditorKeyDown}
                    placeholder={placeholder}
                    aria-label={t("gallery.details.itemNote")}
                />
            ) : (
                <button
                    type="button"
                    className={`details-item-note-body${value.trim() ? "" : " is-placeholder"}`}
                    aria-label={t("gallery.details.itemNote")}
                    onClick={enterEdit}
                >
                    {value.trim() ? value : placeholder}
                </button>
            )}
        </div>
    );
};

type DetailsCopyPathButtonProps = {
    /** Absolute library path written to the clipboard. */
    path: string;
};

/**
 * Hero icon control that copies {@link DetailsCopyPathButtonProps.path} and briefly
 * swaps its tooltip / accessible name to the shared Copied label.
 */
export const DetailsCopyPathButton = ({ path }: DetailsCopyPathButtonProps) => {
    const { t } = useTranslation("settings");
    const { t: tCommon } = useTranslation("common");
    const [copied, setCopied] = useState(false);
    const copiedTimerRef = useRef<number>(0);

    useEffect(() => {
        return () => window.clearTimeout(copiedTimerRef.current);
    }, []);

    const handleClick = () => {
        window.electron.writeText(path);
        setCopied(true);
        window.clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = window.setTimeout(() => setCopied(false), 3000);
    };

    const label = copied ? t("shared.copied") : tCommon("contextMenu.copyPath");

    return (
        <button
            type="button"
            className="details-icon-btn"
            onClick={handleClick}
            aria-label={label}
            data-tooltip={label}
        >
            <FontAwesomeIcon icon={faCopy} />
        </button>
    );
};

/**
 * Clamps a dragged details metadata height so the list stays visible.
 * The rem floor on `.details-meta.is-auto` is separate; this only limits the splitter.
 *
 * @param px Candidate height from a drag
 * @param panelHeightPx Bounding height of `.manga-details-panel`
 */
export const clampDetailsHeroHeight = (px: number, panelHeightPx: number): number => {
    const max = Math.max(1, Math.floor(panelHeightPx * DETAILS_HERO_HEIGHT_MAX_FRACTION));
    const floor = Math.min(DETAILS_HERO_RESIZE_MIN_PX, max);
    return Math.min(Math.max(Math.round(px), floor), max);
};

type DetailsMetaBlockProps = {
    children: ReactNode;
};

type MetaDragStart = {
    clientY: number;
    height: number;
    panelHeight: number;
};

/**
 * Resizable metadata column (hero plus optional missing-path banner) above the
 * details list. Height is {@link AppSettings.galleryDetailsHeroHeight} for both
 * manga and book; `0` means auto (CSS rem min/max on `.is-auto`, overflow scroll).
 */
export const DetailsMetaBlock = ({ children }: DetailsMetaBlockProps) => {
    const { t } = useTranslation("home");
    const dispatch = useAppDispatch();
    const persisted = useAppSelector((store) => store.appSettings.galleryDetailsHeroHeight);
    const [heightPx, setHeightPx] = useState(persisted);
    const [dragging, setDragging] = useState(false);
    const metaRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef<MetaDragStart>({ clientY: 0, height: 0, panelHeight: 0 });
    const skipPersistOnMountRef = useRef(true);

    useLayoutEffect(() => {
        document.body.style.cursor = dragging ? "ns-resize" : "auto";
        if (!dragging) return;

        const handleMove = (e: globalThis.MouseEvent) => {
            const start = dragStartRef.current;
            setHeightPx(clampDetailsHeroHeight(start.height + (e.clientY - start.clientY), start.panelHeight));
        };
        const handleUp = () => setDragging(false);

        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleUp);
        return () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleUp);
            document.body.style.cursor = "auto";
        };
    }, [dragging]);

    useEffect(() => {
        if (dragging) return;
        if (skipPersistOnMountRef.current) {
            skipPersistOnMountRef.current = false;
            return;
        }
        if (heightPx === persisted) return;
        dispatch(setAppSettings({ galleryDetailsHeroHeight: heightPx }));
    }, [dragging, dispatch, heightPx, persisted]);

    const handleResizerMouseDown = (e: MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const meta = metaRef.current;
        const panel = meta?.parentElement;
        dragStartRef.current = {
            clientY: e.clientY,
            height: meta?.getBoundingClientRect().height ?? 0,
            panelHeight: panel?.getBoundingClientRect().height ?? 0,
        };
        setDragging(true);
    };

    return (
        <>
            <div
                ref={metaRef}
                className={`details-meta${heightPx > 0 ? "" : " is-auto"}`}
                style={heightPx > 0 ? { height: heightPx, flex: `0 0 ${heightPx}px` } : undefined}
            >
                {children}
            </div>
            <div
                className={`details-meta-resizer${dragging ? " dragging" : ""}`}
                title={t("gallery.details.resizeMeta")}
                onMouseDown={handleResizerMouseDown}
            />
        </>
    );
};

type DetailsHeroProps = {
    title: string;
    /** Omitted from the DOM when empty. */
    author?: string | null;
    /** Optional type chip next to the title (e.g. EPUB). */
    typeBadge?: string;
    coverSrc: string;
    coverAlt: string;
    onBack: () => void;
    onCoverContextMenu: (e: MouseEvent) => void;
    actions?: ReactNode;
    facts?: ReactNode;
    note?: ReactNode;
    /** When {@link DETAILS_HERO_SYNOPSIS_PREVIEW} is on, also show the genre placeholder. */
    includeGenresPreview?: boolean;
};

/**
 * Shared gallery-details header: cover with overlay back, title/actions, then metadata.
 * About / genres preview (when {@link DETAILS_HERO_SYNOPSIS_PREVIEW} is on) is a
 * full-width row in the facts column, below the progress fields.
 * Chapter / bookmark / note lists stay in each panel.
 */
export const DetailsHero = ({
    title,
    author,
    typeBadge,
    coverSrc,
    coverAlt,
    onBack,
    onCoverContextMenu,
    actions,
    facts,
    note,
    includeGenresPreview = false,
}: DetailsHeroProps) => {
    const { t } = useTranslation("home");
    const showFacts = Boolean(facts) || Boolean(note) || DETAILS_HERO_SYNOPSIS_PREVIEW;
    const authorText = author?.trim();
    const synopsisPreview = DETAILS_HERO_SYNOPSIS_PREVIEW ? (
        <>
            <div className="details-synopsis">
                <div className="details-field-label">{t("gallery.details.about")}</div>
                <p>{t("gallery.details.synopsisPreview")}</p>
            </div>
            {includeGenresPreview ? (
                <div className="details-genres">{t("gallery.details.genresPreview")}</div>
            ) : null}
        </>
    ) : null;

    return (
        <header className={`details-hero${showFacts ? "" : " no-facts"}`}>
            <div className="details-media">
                <button
                    type="button"
                    className="details-back"
                    onClick={onBack}
                    aria-label={t("gallery.details.backToGallery")}
                    data-tooltip={t("gallery.details.backToGallery")}
                >
                    <FontAwesomeIcon icon={faArrowLeft} />
                </button>
                <div className="details-cover-wrap" onContextMenu={onCoverContextMenu}>
                    {coverSrc ? (
                        <img src={coverSrc} alt={coverAlt} className="details-cover" draggable={false} />
                    ) : (
                        <div className="details-cover details-cover-placeholder" aria-hidden>
                            <span>{title[0] || "?"}</span>
                        </div>
                    )}
                </div>
            </div>
            <div className="details-identity">
                <div className="details-title-row">
                    <h2 className="details-title">{title}</h2>
                    {typeBadge ? <span className="details-type-badge">{typeBadge}</span> : null}
                </div>
                {authorText ? <div className="details-author">{authorText}</div> : null}
                {actions ? <div className="details-hero-actions">{actions}</div> : null}
            </div>
            {showFacts ? (
                <div className="details-facts">
                    {facts || synopsisPreview ? (
                        <div className="details-facts-main">
                            {facts}
                            {synopsisPreview}
                        </div>
                    ) : null}
                    {note}
                </div>
            ) : null}
        </header>
    );
};
