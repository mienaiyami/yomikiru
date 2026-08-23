import type { LibraryTag } from "@common/types/db";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { createLibraryTag, deleteLibraryTag, setLibraryItemTags, updateLibraryTag } from "@store/tags";
import InputColor from "@ui/InputColor";
import Modal from "@ui/Modal";
import SelectionCheckbox from "@ui/SelectionCheckbox";
import { colorUtils } from "@utils/color";
import { dialogUtils } from "@utils/dialog";
import {
    assignmentCountForTag,
    catalogHasName,
    DEFAULT_TAG_COLOR,
    normalizeTagName,
    TAG_CHIP_COLORS,
    tagChipTextColor,
    tagsForItem,
} from "@utils/libraryTags";
import { appRootElement } from "@utils/utils";
import { type CSSProperties, type KeyboardEvent, type ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

type ItemTagsRowProps = {
    itemLink: string;
};

type ItemTagsPickerBase = {
    onClose: () => void;
    /** Modal heading; defaults to the gallery picker title. */
    title?: string;
    /** Extra controls in the modal action row (before Close). */
    extraActions?: ReactNode;
};

/**
 * Overlay to assign catalog tags. Either replace-set on a library item, or a
 * caller-owned id list (scan-root folder tags) with the same catalog UI.
 */
export type ItemTagsPickerProps = ItemTagsPickerBase &
    (
        | { itemLink: string }
        | {
              selectedIds: readonly number[];
              onSelectedIdsChange: (ids: number[]) => void;
          }
    );

type ColorSwatchesProps = {
    value: string;
    onChange: (color: string) => void;
};

type TagListFilterProps = {
    value: string;
    onChange: (value: string) => void;
    onKeyDown: (e: KeyboardEvent) => void;
};

/**
 * Catalog list filter: text field plus clear, same chrome as {@link ListNavigator.SearchInput}.
 */
const TagListFilter = ({ value, onChange, onKeyDown }: TagListFilterProps) => {
    const { t } = useTranslation("home");
    const { t: tCommon } = useTranslation("common");
    const hasQuery = value.trim() !== "";
    return (
        <div className="search-input-wrapper item-tags-picker-filter">
            <input
                type="text"
                className="search-input"
                value={value}
                onChange={(e) => onChange(e.currentTarget.value)}
                onKeyDown={onKeyDown}
                placeholder={tCommon("list.typeToSearch")}
                aria-label={t("gallery.tags.listFilter")}
                autoComplete="off"
                spellCheck={false}
            />
            {hasQuery ? (
                <button
                    type="button"
                    className="search-input-clear"
                    aria-label={tCommon("list.clearSearch")}
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onChange("")}
                >
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            ) : null}
        </div>
    );
};

/**
 * Preset swatches (same chrome as book-note colour chips) plus {@link InputColor} for a custom hex.
 */
const ColorSwatches = ({ value, onChange }: ColorSwatchesProps) => {
    const { t } = useTranslation("home");
    const selected = value.toLowerCase();
    return (
        <div className="item-tags-picker-swatches">
            {TAG_CHIP_COLORS.map((color) => (
                <button
                    key={color}
                    type="button"
                    className={`item-tags-picker-preset${selected === color ? " is-active" : ""}`}
                    style={{ backgroundColor: color, "--highlight-color": color } as CSSProperties}
                    aria-label={t("gallery.tags.colorSwatch", { color })}
                    aria-pressed={selected === color}
                    onClick={() => onChange(color)}
                />
            ))}
            <InputColor
                value={colorUtils.new(value)}
                onChange={(next) => onChange(next.hex().toLowerCase())}
                showAlpha={false}
                title={t("gallery.tags.color")}
            />
        </div>
    );
};

/**
 * Overlay to assign catalog tags, create a tag, and rename / recolour / delete.
 * Library-item mode replace-sets assignments; selection mode writes {@link ItemTagsPickerProps} ids.
 */
export const ItemTagsPicker = (props: ItemTagsPickerProps) => {
    const { onClose, extraActions } = props;
    const { t } = useTranslation("home");
    const { t: tCommon } = useTranslation("common");
    const dispatch = useAppDispatch();
    const catalog = useAppSelector((store) => store.tags.catalog);
    const assignments = useAppSelector((store) => store.tags.assignments);
    const assignedIds = new Set(
        "itemLink" in props
            ? tagsForItem(catalog, assignments, props.itemLink).map((tag) => tag.id)
            : props.selectedIds,
    );
    const sortedCatalog = [...catalog].sort((a, b) => a.name.localeCompare(b.name));
    const heading = props.title ?? t("gallery.tags.pickerTitle");

    const [newName, setNewName] = useState("");
    const [newColor, setNewColor] = useState(DEFAULT_TAG_COLOR);
    const [createError, setCreateError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");
    const [editColor, setEditColor] = useState(DEFAULT_TAG_COLOR);
    const [editError, setEditError] = useState<string | null>(null);
    const [listFilter, setListFilter] = useState("");
    const listQuery = listFilter.trim().toLowerCase();
    /* Keep the row being renamed visible even if the list filter would hide it. */
    const visibleCatalog = sortedCatalog.filter(
        (tag) => editingId === tag.id || !listQuery || tag.name.toLowerCase().includes(listQuery),
    );

    const assignedIdList = (): number[] =>
        "itemLink" in props
            ? tagsForItem(catalog, assignments, props.itemLink).map((tag) => tag.id)
            : [...props.selectedIds];

    const applyIds = async (tagIds: number[]): Promise<void> => {
        if ("itemLink" in props) {
            await dispatch(setLibraryItemTags({ itemLink: props.itemLink, tagIds })).unwrap();
            return;
        }
        props.onSelectedIdsChange([...new Set(tagIds)]);
    };

    const handleToggle = async (tagId: number, checked: boolean) => {
        const current = assignedIdList();
        const tagIds = checked ? [...current, tagId] : current.filter((id) => id !== tagId);
        await applyIds(tagIds);
    };

    const handleCreate = async () => {
        const name = normalizeTagName(newName);
        if (!name) return;
        if (catalogHasName(catalog, name)) {
            setCreateError(t("gallery.tags.duplicateName"));
            return;
        }
        setCreateError(null);
        const row = await dispatch(createLibraryTag({ name, color: newColor })).unwrap();
        if (!row) {
            setCreateError(t("gallery.tags.duplicateName"));
            return;
        }
        setNewName("");
        await applyIds([...assignedIdList(), row.id]);
    };

    const startEdit = (tag: LibraryTag) => {
        setEditingId(tag.id);
        setEditName(tag.name);
        setEditColor(tag.color);
        setEditError(null);
    };

    const handleSaveEdit = async () => {
        if (editingId == null) return;
        const name = normalizeTagName(editName);
        if (!name) return;
        if (catalogHasName(catalog, name, editingId)) {
            setEditError(t("gallery.tags.duplicateName"));
            return;
        }
        const row = await dispatch(updateLibraryTag({ id: editingId, name, color: editColor })).unwrap();
        if (!row) {
            setEditError(t("gallery.tags.duplicateName"));
            return;
        }
        setEditingId(null);
        setEditError(null);
    };

    const handleDelete = async (tag: LibraryTag) => {
        const count = assignmentCountForTag(assignments, tag.id);
        const { response } = await dialogUtils.warn({
            title: t("gallery.tags.deleteTitle"),
            message: t("gallery.tags.deleteMessage", { count }),
            noOption: false,
            buttons: [tCommon("actions.cancel"), tCommon("actions.yes")],
            defaultId: 0,
            cancelId: 0,
        });
        if (!response) return;
        await dispatch(deleteLibraryTag({ id: tag.id })).unwrap();
        if (editingId === tag.id) setEditingId(null);
    };

    /* Modal overlay treats Space as click; name fields must not bubble those keys. */
    const stopModalKeys = (e: KeyboardEvent) => {
        e.stopPropagation();
    };

    /* details meta containment clips position:fixed; host on #app without changing Modal */
    return createPortal(
        <Modal open onClose={onClose} className="item-tags-picker">
            <h3>{heading}</h3>
            {sortedCatalog.length > 0 ? (
                <TagListFilter value={listFilter} onChange={setListFilter} onKeyDown={stopModalKeys} />
            ) : null}
            {sortedCatalog.length === 0 ? <p>{t("gallery.tags.emptyCatalog")}</p> : null}
            {sortedCatalog.length > 0 && visibleCatalog.length === 0 ? (
                <p>{t("gallery.tags.noFilterMatches")}</p>
            ) : null}
            <ul className="item-tags-picker-list">
                {visibleCatalog.map((tag) => {
                    const editing = editingId === tag.id;
                    const assigned = assignedIds.has(tag.id);
                    return (
                        <li key={tag.id} className="item-tags-picker-row">
                            <div className="item-tags-picker-row-main">
                                <SelectionCheckbox
                                    className="rowSelectCheck item-tags-assign-check"
                                    checked={assigned}
                                    onToggle={() => void handleToggle(tag.id, !assigned)}
                                    ariaLabel={t("gallery.tags.assignAria", { name: tag.name })}
                                    tabIndex={0}
                                />
                                {!editing ? (
                                    <span
                                        className="item-tag-chip"
                                        style={{ background: tag.color, color: tagChipTextColor(tag.color) }}
                                        onClick={() => void handleToggle(tag.id, !assigned)}
                                    >
                                        {tag.name}
                                    </span>
                                ) : null}
                                {editing ? (
                                    <>
                                        <input
                                            className="item-tags-picker-name"
                                            type="text"
                                            value={editName}
                                            onChange={(e) => setEditName(e.currentTarget.value)}
                                            onKeyDown={stopModalKeys}
                                            aria-label={t("gallery.tags.rename")}
                                        />
                                        <button type="button" onClick={() => setEditingId(null)}>
                                            {tCommon("actions.cancel")}
                                        </button>
                                        <button type="button" onClick={() => void handleSaveEdit()}>
                                            {tCommon("actions.save")}
                                        </button>
                                    </>
                                ) : (
                                    <div className="item-tags-picker-row-actions">
                                        <button type="button" onClick={() => startEdit(tag)}>
                                            {t("gallery.tags.rename")}
                                        </button>
                                        <button type="button" onClick={() => void handleDelete(tag)}>
                                            {t("gallery.tags.delete")}
                                        </button>
                                    </div>
                                )}
                            </div>
                            {editing ? (
                                <div className="item-tags-picker-edit">
                                    <ColorSwatches value={editColor} onChange={setEditColor} />
                                    {editError ? <p className="item-tags-picker-error">{editError}</p> : null}
                                </div>
                            ) : null}
                        </li>
                    );
                })}
            </ul>
            <div className="item-tags-picker-create">
                <label className="item-metadata-editor-field" htmlFor="item-tags-new-name">
                    {t("gallery.tags.newName")}
                </label>
                <input
                    id="item-tags-new-name"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.currentTarget.value)}
                    onKeyDown={stopModalKeys}
                    placeholder={t("gallery.tags.newNamePlaceholder")}
                />
                <ColorSwatches value={newColor} onChange={setNewColor} />
                {createError ? <p className="item-tags-picker-error">{createError}</p> : null}
                <button type="button" onClick={() => void handleCreate()} disabled={!normalizeTagName(newName)}>
                    {t("gallery.tags.create")}
                </button>
            </div>
            <div className="modal-actions">
                {extraActions}
                <button type="button" onClick={onClose}>
                    {tCommon("actions.close")}
                </button>
            </div>
        </Modal>,
        appRootElement(),
    );
};

/**
 * Assigned catalog tags on a details hero, plus a control that opens {@link ItemTagsPicker}.
 */
export const ItemTagsRow = ({ itemLink }: ItemTagsRowProps) => {
    const { t } = useTranslation("home");
    const catalog = useAppSelector((store) => store.tags.catalog);
    const assignments = useAppSelector((store) => store.tags.assignments);
    const assigned = tagsForItem(catalog, assignments, itemLink);
    const [open, setOpen] = useState(false);

    return (
        <div className="details-tags">
            <div className="details-field-label">{t("gallery.tags.label")}</div>
            <div className="details-tags-list">
                {assigned.map((tag) => (
                    <span
                        key={tag.id}
                        className="item-tag-chip"
                        style={{ background: tag.color, color: tagChipTextColor(tag.color) }}
                    >
                        {tag.name}
                    </span>
                ))}
                <button type="button" onClick={() => setOpen(true)}>
                    {t("gallery.tags.edit")}
                </button>
            </div>
            {open ? <ItemTagsPicker itemLink={itemLink} onClose={() => setOpen(false)} /> : null}
        </div>
    );
};
