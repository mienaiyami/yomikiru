import type { LibraryTag } from "@common/types/db";
import { faTags } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import InputMultiSelect, { type InputMultiSelectOption } from "@ui/InputMultiSelect";
import { type GalleryTagFilterSelection, tagChipTextColor, tagFilterActivatorMarks } from "@utils/libraryTags";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

/** Cap on colour marks in the closed activator (extra selected tags are omitted). */
const ACTIVATOR_COLOR_MARK_MAX = 8;

export type { GalleryTagFilterSelection };

/** Props for {@link GalleryTagFilterBar}. */
export type GalleryTagFilterBarProps = {
    catalog: readonly LibraryTag[];
    tagFilter: GalleryTagFilterSelection;
    onFilterChange: (next: GalleryTagFilterSelection) => void;
};

/**
 * Multi-tag filter persisted as signed `galleryTagFilterIds`.
 * Empty include and exclude means no tag constraint. Opt-in tri-state on {@link InputMultiSelect}:
 * off -> include -> exclude. Activator shows the tag name when only one is included or
 * excluded, otherwise the include/exclude count keys, plus same-sized circle/triangle marks.
 * Hidden by the parent when the catalog is empty.
 */
const GalleryTagFilterBar = ({ catalog, tagFilter, onFilterChange }: GalleryTagFilterBarProps) => {
    const { t } = useTranslation("home");
    const includeIds = tagFilter.includeIds;
    const excludeIds = tagFilter.excludeIds;
    const sorted = useMemo(() => [...catalog].sort((a, b) => a.name.localeCompare(b.name)), [catalog]);
    const tagById = useMemo(() => new Map(sorted.map((tag) => [tag.id, tag])), [sorted]);
    const includeSet = new Set(includeIds);
    const excludeSet = new Set(excludeIds);
    const activatorMarks = tagFilterActivatorMarks(sorted, tagFilter, ACTIVATOR_COLOR_MARK_MAX);
    const isEmpty = includeIds.length === 0 && excludeIds.length === 0;

    /* stable option/value arrays so InputMultiSelect does not see new refs every parent paint */
    const options: InputMultiSelectOption[] = useMemo(
        () =>
            sorted.map((tag) => ({
                value: String(tag.id),
                label: tag.name,
            })),
        [sorted],
    );
    const includeStrings = useMemo(() => includeIds.map(String), [includeIds]);
    const excludeStrings = useMemo(() => excludeIds.map(String), [excludeIds]);

    const emptyActivatorLabel = t("gallery.tags.filterNoConstraint");
    const activatorCountLabel = (() => {
        if (isEmpty) return emptyActivatorLabel;
        if (includeIds.length === 1 && excludeIds.length === 0) {
            const includeId = includeIds[0];
            return (
                (includeId !== undefined && tagById.get(includeId)?.name) ||
                t("gallery.tags.filterPlusCount", { count: 1 })
            );
        }
        if (includeIds.length === 0 && excludeIds.length === 1) {
            const excludeId = excludeIds[0];
            return (
                (excludeId !== undefined && tagById.get(excludeId)?.name) ||
                t("gallery.tags.filterMinusCount", { count: 1 })
            );
        }
        if (excludeIds.length === 0) return t("gallery.tags.filterPlusCount", { count: includeIds.length });
        if (includeIds.length === 0) return t("gallery.tags.filterMinusCount", { count: excludeIds.length });
        return t("gallery.tags.filterPlusMinusCount", {
            plus: includeIds.length,
            minus: excludeIds.length,
        });
    })();

    return (
        <nav className="galleryTagFilterBar" aria-label={t("gallery.tags.filterAria")}>
            <InputMultiSelect
                triState
                className="galleryTagFilterSelect"
                activatorClassName="galleryTagFilterActivator"
                popoverClassName="galleryTagFilterPopover"
                value={includeStrings}
                excludedValues={excludeStrings}
                onChange={(included, excluded = []) =>
                    onFilterChange({
                        includeIds: included.map(Number),
                        excludeIds: excluded.map(Number),
                    })
                }
                options={options}
                emptyLabel={emptyActivatorLabel}
                activatorTitle={isEmpty ? t("gallery.tags.filterAllTitle") : undefined}
                multipleLabel={(count) => t("gallery.tags.filterCount", { count })}
                toggleAllLabel={(_allSelected, aggregate = "off") => {
                    if (aggregate === "on") return t("gallery.tags.filterExcludeAll");
                    if (aggregate === "exclude") return t("gallery.tags.filterUnselectAll");
                    return t("gallery.tags.filterSelectAll");
                }}
                optionAriaLabel={(option) => {
                    const name = option.label;
                    const id = Number(option.value);
                    if (includeSet.has(id)) return t("gallery.tags.filterOptionIncludedAria", { name });
                    if (excludeSet.has(id)) return t("gallery.tags.filterOptionExcludedAria", { name });
                    return t("gallery.tags.filterOptionOffAria", { name });
                }}
                aria-label={t("gallery.tags.filterAria")}
                renderActivatorLabel={() => (
                    <>
                        <FontAwesomeIcon icon={faTags} className="galleryTagFilterIcon" aria-hidden />
                        {activatorMarks.length > 0 ? (
                            <span className="galleryTagFilterDots" aria-hidden>
                                {activatorMarks.map((mark) => (
                                    <span
                                        key={mark.id}
                                        className={
                                            mark.shape === "triangle"
                                                ? "galleryTagFilterDot galleryTagFilterMarkTriangle"
                                                : "galleryTagFilterDot"
                                        }
                                        style={{ backgroundColor: mark.color }}
                                    />
                                ))}
                            </span>
                        ) : null}
                        <span className="galleryTagFilterLabel">{activatorCountLabel}</span>
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
