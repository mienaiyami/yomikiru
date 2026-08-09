import home from "@common/i18n/locales/en/home.json";
import { fireEvent, render } from "@testing-library/react";
import i18n from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";
import GalleryTypeFilterBar, { type GalleryTypeFilterId } from "./GalleryTypeFilterBar";

beforeAll(async () => {
    if (!i18n.isInitialized) {
        await i18n.use(initReactI18next).init({
            lng: "en",
            resources: { en: { home } },
            ns: ["home"],
            defaultNS: "home",
            interpolation: { escapeValue: false },
            react: { useSuspense: false },
        });
    } else if (!i18n.hasResourceBundle("en", "home")) {
        i18n.addResourceBundle("en", "home", home, true, true);
    }
});

/**
 * Renders {@link GalleryTypeFilterBar} with a mock `onFilterChange` for assertions.
 */
const renderBar = (activeFilter: GalleryTypeFilterId = "all") => {
    const onFilterChange = vi.fn();
    const utils = render(
        <I18nextProvider i18n={i18n}>
            <GalleryTypeFilterBar activeFilter={activeFilter} onFilterChange={onFilterChange} />
        </I18nextProvider>,
    );
    return { ...utils, onFilterChange };
};

describe("GalleryTypeFilterBar", () => {
    it("marks only the active filter as pressed", () => {
        const { container } = renderBar("book");
        const pressed = container.querySelectorAll('button[aria-pressed="true"]');
        expect(pressed).toHaveLength(1);
        expect(pressed[0].textContent).toContain("eBook");
    });

    it("reports the picked filter id", () => {
        const { container, onFilterChange } = renderBar("all");
        const buttons = container.querySelectorAll("button");
        fireEvent.click(buttons[1]);
        expect(onFilterChange).toHaveBeenCalledWith("manga");
        fireEvent.click(buttons[2]);
        expect(onFilterChange).toHaveBeenCalledWith("book");
    });

    it("spells out what each type covers in its tooltip", () => {
        const { container } = renderBar();
        const [, manga, book] = Array.from(container.querySelectorAll("button"));
        expect(manga.getAttribute("data-tooltip")).toMatch(/manhwa/i);
        expect(manga.getAttribute("data-tooltip")).toMatch(/webtoon/i);
        expect(book.getAttribute("data-tooltip")).toMatch(/EPUB/);
        expect(book.getAttribute("data-tooltip")).toMatch(/PDF is not included/i);
    });
});
