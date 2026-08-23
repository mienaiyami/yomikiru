import type { LibraryTag } from "@common/types/db";
import { faTags } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import InputMultiSelect, { type InputMultiSelectOption } from "@ui/InputMultiSelect";
import { tagChipTextColor } from "@utils/libraryTags";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

/** Cap on colour dots in the closed activator (extra selected tags are omitted). */
const ACTIVATOR_COLOR_DOT_MAX = 8;

/** Persisted gallery tag filter: empty means every item (no tag constraint). */
export type GalleryTagFilterIds = readonly number[];

/** Props for {@link GalleryTagFilterBar}. */
export type GalleryTagFilterBarProps = {
    catalog: readonly LibraryTag[];
    selectedTagIds: GalleryTagFilterIds;
    onFilterChange: (tagIds: GalleryTagFilterIds) => void;
};

/**
 * Multi-tag filter (OR) persisted as `galleryTagFilterIds`: empty means no tag constraint.
 * Uses {@link InputMultiSelect}; activator shows no filter / one name / count,
 * plus a capped row of selected-tag colour dots.
 * Hidden by the parent when the catalog is empty.
 */
const GalleryTagFilterBar = ({ catalog, selectedTagIds, onFilterChange }: GalleryTagFilterBarProps) => {
    const { t } = useTranslation("home");
    const sorted = useMemo(() => [...catalog].sort((a, b) => a.name.localeCompare(b.name)), [catalog]);
    const tagById = useMemo(() => new Map(sorted.map((tag) => [tag.id, tag])), [sorted]);
    const selectedIdSet = new Set(selectedTagIds);
    const selectedTags = sorted.filter((tag) => selectedIdSet.has(tag.id));
    const activatorDots = selectedTags.slice(0, ACTIVATOR_COLOR_DOT_MAX);

    /* stable option/value arrays so InputMultiSelect does not see new refs every parent paint */
    const options: InputMultiSelectOption[] = useMemo(
        () =>
            sorted.map((tag) => ({
                value: String(tag.id),
                label: tag.name,
            })),
        [sorted],
    );
    const valueStrings = useMemo(() => selectedTagIds.map(String), [selectedTagIds]);

    const emptyActivatorLabel = t("gallery.tags.filterNoConstraint");

    return (
        <nav className="galleryTagFilterBar" aria-label={t("gallery.tags.filterAria")}>
            <InputMultiSelect
                className="galleryTagFilterSelect"
                activatorClassName="galleryTagFilterActivator"
                popoverClassName="galleryTagFilterPopover"
                value={valueStrings}
                onChange={(next) => onFilterChange(next.map(Number))}
                options={options}
                emptyLabel={emptyActivatorLabel}
                activatorTitle={selectedTagIds.length === 0 ? t("gallery.tags.filterAllTitle") : undefined}
                multipleLabel={(count) => t("gallery.tags.filterCount", { count })}
                toggleAllLabel={(allSelected) =>
                    allSelected ? t("gallery.tags.filterUnselectAll") : t("gallery.tags.filterSelectAll")
                }
                optionAriaLabel={(option) => t("gallery.tags.filterOptionAria", { name: option.label })}
                aria-label={t("gallery.tags.filterAria")}
                renderActivatorLabel={({ isEmpty, selectedOptions }) => (
                    <>
                        <FontAwesomeIcon icon={faTags} className="galleryTagFilterIcon" aria-hidden />
                        {activatorDots.length > 0 ? (
                            <span className="galleryTagFilterDots" aria-hidden>
                                {activatorDots.map((tag) => (
                                    <span
                                        key={tag.id}
                                        className="galleryTagFilterDot"
                                        style={{ backgroundColor: tag.color }}
                                    />
                                ))}
                            </span>
                        ) : null}
                        <span className="galleryTagFilterLabel">
                            {isEmpty
                                ? emptyActivatorLabel
                                : selectedOptions.length === 1
                                  ? selectedOptions[0]!.label
                                  : t("gallery.tags.filterCount", { count: selectedOptions.length })}
                        </span>
                    </>
                )}
                renderOption={({ option, checkbox }) => {
                    const tag = tagById.get(Number(option.value));
                    return (
                        <>
                            {checkbox}
                            {tag ? (
                                <span
                                    className="item-tag-chip inputMultiSelectTagChip"
                                    aria-hidden
                                    style={{
                                        background: tag.color,
                                        color: tagChipTextColor(tag.color),
                                    }}
                                >
                                    {tag.name}
                                </span>
                            ) : (
                                <span className="inputMultiSelectRowLabel" aria-hidden>
                                    {option.label}
                                </span>
                            )}
                        </>
                    );
                }}
            />
        </nav>
    );
};

export default GalleryTagFilterBar;
