import home from "@common/i18n/locales/en/home.json";
import settings from "@common/i18n/locales/en/settings.json";
import type { LibraryTag } from "@common/types/db";
import { renderWithProviders } from "@test/renderWithProviders";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LibraryScanRootOptions from "./LibraryScanRootOptions";

const { setColorSelectData } = vi.hoisted(() => ({
    setColorSelectData: vi.fn(),
}));

vi.mock("@renderer/App", () => ({
    useAppContext: () => ({ setColorSelectData }),
}));

/** Catalog fixture for the scan-root tags modal. */
const catalog: LibraryTag[] = [{ id: 1, name: "Ongoing", color: "#2563eb", createdAt: new Date(0) }];

/** Renders {@link LibraryScanRootOptions} with optional prop and catalog overrides. */
const renderOptions = (
    patch: Partial<Parameters<typeof LibraryScanRootOptions>[0]> = {},
    tags: LibraryTag[] = catalog,
) => {
    const onBackfill = vi.fn();
    const onSkipPatternChange = vi.fn();
    const onTagIdsChange = vi.fn();
    const view = renderWithProviders(
        <LibraryScanRootOptions
            skipPattern=""
            tagIds={[1]}
            skipInputId="settings-scan-default-location-skip"
            tagsId="settings-scan-default-location-tags"
            disabled={false}
            onSkipPatternChange={onSkipPatternChange}
            onTagIdsChange={onTagIdsChange}
            onBackfill={onBackfill}
            backfillBusy={false}
            backfillFeedback="idle"
            {...patch}
        />,
        { preloadedState: { tags: { catalog: tags, assignments: [] } } },
    );
    return { ...view, onBackfill, onSkipPatternChange, onTagIdsChange };
};

describe("LibraryScanRootOptions", () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it("keeps skip input and tags on one row and opens apply in the modal", () => {
        const { onBackfill } = renderOptions();
        const skip = screen.getByLabelText(settings.library.skipPattern);
        const tagsBtn = screen.getByRole("button", { name: settings.library.folderTags });
        expect(skip.closest(".libraryScanRootRow")).toBe(tagsBtn.closest(".libraryScanRootRow"));
        expect(screen.queryByRole("button", { name: settings.library.backfillTags })).toBeNull();
        fireEvent.click(tagsBtn);
        expect(document.body.querySelector(".item-tags-picker")).not.toBeNull();
        expect(screen.getByRole("textbox", { name: home.gallery.tags.listFilter })).toBeInTheDocument();
        const backfill = screen.getByRole("button", { name: settings.library.backfillTags });
        expect(backfill).toHaveAttribute("data-tooltip", settings.library.backfillTooltip);
        fireEvent.click(backfill);
        expect(onBackfill).toHaveBeenCalledTimes(1);
    });

    it("shows an inline error for an invalid skip pattern", () => {
        renderOptions({ skipPattern: "(", tagIds: [] }, []);
        expect(screen.getByText(settings.library.skipPatternInvalid)).toBeInTheDocument();
    });

    it("debounces skip-pattern persist instead of writing on every keystroke", () => {
        vi.useFakeTimers();
        const { onSkipPatternChange } = renderOptions();
        fireEvent.change(screen.getByLabelText(settings.library.skipPattern), { target: { value: "Archived" } });
        expect(onSkipPatternChange).not.toHaveBeenCalled();
        vi.advanceTimersByTime(500);
        expect(onSkipPatternChange).toHaveBeenCalledWith("Archived");
        vi.useRealTimers();
    });
});
