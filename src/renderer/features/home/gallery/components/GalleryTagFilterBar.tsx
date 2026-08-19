import type { LibraryTag } from "@common/types/db";
import InputSelect from "@ui/InputSelect";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

/** Session-only gallery tag filter: `null` means every item (no tag constraint). */
export type GalleryTagFilterId = number | null;

/** Props for {@link GalleryTagFilterBar}. */
export type GalleryTagFilterBarProps = {
    catalog: readonly LibraryTag[];
    selectedTagId: GalleryTagFilterId;
    onFilterChange: (tagId: GalleryTagFilterId) => void;
};

/** {@link InputSelect} value for no tag constraint. */
const ALL_VALUE = "";

/** Left colour stripe width for the closed control and menu rows. Seeded on the bar as `--gallery-tag-filter-stripe`. */
export const TAG_FILTER_STRIPE = "12px";

/**
 * Session-only filter: no tag constraint, or items that have one catalog tag.
 * Uses {@link InputSelect} (MenuList). Tag colour is a left inset box-shadow; long names ellipsis.
 * Hidden by the parent when the catalog is empty.
 */
const GalleryTagFilterBar = ({ catalog, selectedTagId, onFilterChange }: GalleryTagFilterBarProps) => {
    const { t } = useTranslation("home");
    const sorted = [...catalog].sort((a, b) => a.name.localeCompare(b.name));
    const selected = sorted.find((tag) => tag.id === selectedTagId);
    const options: Menu.OptSelectOption[] = [
        { value: ALL_VALUE, label: t("gallery.tags.filterAll") },
        ...sorted.map((tag) => ({
            value: String(tag.id),
            label: tag.name,
            style: {
                boxShadow: `inset ${TAG_FILTER_STRIPE} 0 0 ${tag.color}`,
                paddingLeft: `calc(10px + ${TAG_FILTER_STRIPE})`,
            },
        })),
    ];

    return (
        <nav
            className="galleryTagFilterBar"
            aria-label={t("gallery.tags.filterAria")}
            /* InputSelect does not apply option.style to the closed button */
            style={
                {
                    "--gallery-tag-filter-stripe": TAG_FILTER_STRIPE,
                    ...(selected ? { "--gallery-tag-filter-color": selected.color } : {}),
                } as CSSProperties
            }
        >
            <InputSelect
                className="galleryTagFilterSelect"
                value={selectedTagId == null ? ALL_VALUE : String(selectedTagId)}
                onChange={(value) => onFilterChange(value === ALL_VALUE ? null : Number(value))}
                options={options}
            />
        </nav>
    );
};

export default GalleryTagFilterBar;
