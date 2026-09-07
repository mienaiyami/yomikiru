import anilistEn from "@common/i18n/locales/en/anilist.json";
import home from "@common/i18n/locales/en/home.json";
import { renderWithI18n, renderWithProviders } from "@test/renderWithProviders";
import { fireEvent, screen } from "@testing-library/react";
import { defaultSettings } from "@utils/settingsSchema";
import { describe, expect, it, vi } from "vitest";
import {
    clampDetailsHeroHeight,
    DETAILS_HERO_HEIGHT_MAX_FRACTION,
    DETAILS_HERO_RESIZE_MIN_PX,
    DetailsHero,
    DetailsLayout,
    DetailsListToolbar,
    DetailsMetaBlock,
} from "./DetailsHero";

/** Splitter clamp only; the rem auto floor lives in CSS on `.details-meta.is-auto`. */

describe("clampDetailsHeroHeight", () => {
    it("uses the resize min when the panel is tall enough", () => {
        expect(clampDetailsHeroHeight(10, 2000)).toBe(DETAILS_HERO_RESIZE_MIN_PX);
    });

    it("lowers the floor to the panel fraction when the panel is shorter than the resize min", () => {
        expect(clampDetailsHeroHeight(10, 100)).toBe(Math.floor(100 * DETAILS_HERO_HEIGHT_MAX_FRACTION));
    });

    it("caps at the panel fraction when the candidate is larger", () => {
        const panel = 1000;
        expect(clampDetailsHeroHeight(9999, panel)).toBe(Math.floor(panel * DETAILS_HERO_HEIGHT_MAX_FRACTION));
    });

    it("passes through a value already inside the range", () => {
        expect(clampDetailsHeroHeight(400, 1000)).toBe(400);
    });
});

describe("DetailsListToolbar", () => {
    it("switches the persisted details hero from vertical to horizontal view", () => {
        const { store } = renderWithProviders(<DetailsListToolbar tabBar={<span>Tabs</span>} />, {
            preloadedState: {
                appSettings: { ...defaultSettings, galleryDetailsHeroLayout: "vertical" },
            },
        });

        fireEvent.click(screen.getByRole("button", { name: "Use horizontal details view" }));

        expect(store.getState().appSettings.galleryDetailsHeroLayout).toBe("horizontal");
        expect(screen.getByRole("button", { name: "Use vertical details view" })).toHaveAttribute(
            "aria-pressed",
            "true",
        );
    });
});

describe("DetailsLayout", () => {
    it("uses the horizontal split and width resizer when that view is persisted", () => {
        const { container } = renderWithProviders(
            <DetailsLayout>
                <DetailsMetaBlock>
                    <span>Hero</span>
                </DetailsMetaBlock>
                <div className="details-stage">Stage</div>
            </DetailsLayout>,
            {
                preloadedState: {
                    appSettings: {
                        ...defaultSettings,
                        galleryDetailsHeroLayout: "horizontal",
                        galleryDetailsHeroWidth: 960,
                    },
                },
            },
        );

        expect(container.querySelector(".details-layout")).toHaveClass("is-horizontal");
        expect(container.querySelector(".details-meta")).toHaveStyle({ width: "960px" });
        expect(screen.getByTitle("Resize details sidebar")).toBeInTheDocument();
    });

    it("persists the horizontal hero floor after a shorter drag", () => {
        const { container, store } = renderWithProviders(
            <DetailsLayout>
                <DetailsMetaBlock>
                    <span>Hero</span>
                </DetailsMetaBlock>
                <div className="details-stage">Stage</div>
            </DetailsLayout>,
            {
                preloadedState: {
                    appSettings: {
                        ...defaultSettings,
                        galleryDetailsHeroLayout: "horizontal",
                        galleryDetailsHeroWidth: 640,
                    },
                },
            },
        );
        const layout = container.querySelector(".details-layout");
        const meta = container.querySelector(".details-meta");
        expect(layout).toBeInstanceOf(HTMLElement);
        expect(meta).toBeInstanceOf(HTMLElement);
        vi.spyOn(layout as HTMLElement, "getBoundingClientRect").mockReturnValue({
            width: 1200,
            height: 800,
        } as DOMRect);
        vi.spyOn(meta as HTMLElement, "getBoundingClientRect").mockReturnValue({
            width: 640,
            height: 800,
        } as DOMRect);

        fireEvent.mouseDown(screen.getByTitle("Resize details sidebar"), { button: 0, clientX: 640 });
        fireEvent.mouseMove(window, { clientX: 500 });
        fireEvent.mouseUp(window);

        expect(meta).toHaveStyle({ width: "608px" });
        expect(store.getState().appSettings.galleryDetailsHeroWidth).toBe(608);
    });
});

describe("DetailsHero", () => {
    it("separates local summary fields from the note and tracker-derived data", () => {
        const { container } = renderWithI18n(
            <DetailsHero
                title="Title"
                coverSrc=""
                coverAlt=""
                onBack={vi.fn()}
                onCoverContextMenu={vi.fn()}
                description={"<b>Bold</b> line<br>next"}
                genres={["Drama", "Action"]}
                trackerMedia={{ status: "RELEASING" }}
                actions={<span data-testid="hero-anilist-control">Track</span>}
                facts={<span data-testid="hero-progress">progress</span>}
                tags={<span data-testid="hero-tags">tags</span>}
                note={<span data-testid="hero-note">note</span>}
            />,
        );
        const about = container.querySelector(".details-synopsis-body");
        expect(about?.innerHTML).toContain("<b>Bold</b>");
        expect(about?.innerHTML).toContain("<br>");
        const localFacts = container.querySelector(".details-local-facts");
        const localTags = container.querySelector(".details-local-tags");
        const catalogMetadata = container.querySelector(".details-catalog-metadata");
        const noteMetadata = container.querySelector(".details-note-metadata");
        const actions = container.querySelector(".details-hero-actions");
        const progress = screen.getByTestId("hero-progress");
        const tags = screen.getByTestId("hero-tags");
        const note = screen.getByTestId("hero-note");
        const anilistControl = screen.getByTestId("hero-anilist-control");
        expect(localFacts?.contains(progress)).toBe(true);
        expect(localTags?.contains(tags)).toBe(true);
        expect(noteMetadata?.contains(note)).toBe(true);
        expect(catalogMetadata?.textContent).toContain("Drama");
        expect(catalogMetadata?.textContent).toContain(anilistEn.status.RELEASING);
        expect(actions?.contains(anilistControl)).toBe(true);
    });

    it("shows the original library title muted after an edited primary title", () => {
        renderWithI18n(
            <DetailsHero
                title="Edited"
                originalTitle="Folder Name"
                coverSrc=""
                coverAlt=""
                onBack={vi.fn()}
                onCoverContextMenu={vi.fn()}
            />,
        );
        expect(screen.getByRole("heading", { name: "Edited (Folder Name)" })).toBeInTheDocument();
        expect(screen.getByTitle("Edited (Folder Name)")).toBeInTheDocument();
    });

    it("places an AniList external link above About without confirm", () => {
        const openExternal = vi.mocked(window.electron.openExternal);
        const { container } = renderWithI18n(
            <DetailsHero
                title="Title"
                coverSrc=""
                coverAlt=""
                onBack={vi.fn()}
                onCoverContextMenu={vi.fn()}
                description="About text"
                tracker={{ provider: "anilist", remoteId: "99", remoteUrl: null }}
            />,
        );
        const link = screen.getByText(home.gallery.details.openOnAnilist);
        const main = container.querySelector(".details-facts-main")?.innerHTML ?? "";
        expect(main.indexOf("details-tracker-external")).toBeLessThan(main.indexOf("details-synopsis"));
        fireEvent.click(link);
        expect(openExternal).toHaveBeenCalledWith("https://anilist.co/manga/99");
    });

    it("hides the tracker external link when remote id is missing from the url helper", () => {
        renderWithI18n(
            <DetailsHero
                title="Title"
                coverSrc=""
                coverAlt=""
                onBack={vi.fn()}
                onCoverContextMenu={vi.fn()}
                tracker={{ provider: "anilist", remoteId: "  ", remoteUrl: null }}
            />,
        );
        expect(screen.queryByText(home.gallery.details.openOnAnilist)).toBeNull();
    });

    it("opens the stored remoteUrl when present instead of rebuilding from remoteId", () => {
        const openExternal = vi.mocked(window.electron.openExternal);
        renderWithI18n(
            <DetailsHero
                title="Title"
                coverSrc=""
                coverAlt=""
                onBack={vi.fn()}
                onCoverContextMenu={vi.fn()}
                tracker={{
                    provider: "anilist",
                    remoteId: "99",
                    remoteUrl: "https://anilist.co/manga/12345",
                }}
            />,
        );
        fireEvent.click(screen.getByText(home.gallery.details.openOnAnilist));
        expect(openExternal).toHaveBeenCalledWith("https://anilist.co/manga/12345");
    });

    it("places tracker catalog facts above genres", () => {
        const { container } = renderWithI18n(
            <DetailsHero
                title="Title"
                coverSrc=""
                coverAlt=""
                onBack={vi.fn()}
                onCoverContextMenu={vi.fn()}
                genres={["Drama"]}
                trackerMedia={{ status: "RELEASING", score: 78, totalChapters: 12, format: "MANGA" }}
            />,
        );
        const main = container.querySelector(".details-facts-main")?.textContent ?? "";
        expect(main.indexOf(anilistEn.status.RELEASING)).toBeGreaterThanOrEqual(0);
        expect(main.indexOf(anilistEn.status.RELEASING)).toBeLessThan(main.indexOf("Drama"));
        expect(main).toContain(anilistEn.status.RELEASING);
        expect(main).toContain("Score 78");
        expect(main).toContain("12 chapters");
        expect(main).toContain(anilistEn.format.MANGA);
        expect(container.querySelector(".details-tracker-facts")).not.toBeNull();
    });

    it("hides tracker facts when the media snapshot has nothing to show", () => {
        renderWithI18n(
            <DetailsHero
                title="Title"
                coverSrc=""
                coverAlt=""
                onBack={vi.fn()}
                onCoverContextMenu={vi.fn()}
                trackerMedia={{ status: null, score: null, totalChapters: null, format: null }}
            />,
        );
        expect(document.querySelector(".details-tracker-facts")).toBeNull();
    });

    it("toggles the cover source from Default to AniList when a tracker image exists", () => {
        const onCoverSourceChange = vi.fn();
        renderWithI18n(
            <DetailsHero
                title="Title"
                coverSrc=""
                coverAlt=""
                onBack={vi.fn()}
                onCoverContextMenu={vi.fn()}
                trackerCoverAvailable
                coverSource="library"
                onCoverSourceChange={onCoverSourceChange}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: home.gallery.details.coverSourceLibrary }));
        expect(onCoverSourceChange).toHaveBeenCalledWith("tracker");
        expect(
            screen
                .getByRole("button", { name: home.gallery.details.coverSourceLibrary })
                .closest(".details-hero-actions"),
        ).not.toBeNull();
    });

    it("toggles the cover source back to Default when AniList is selected", () => {
        const onCoverSourceChange = vi.fn();
        renderWithI18n(
            <DetailsHero
                title="Title"
                coverSrc=""
                coverAlt=""
                onBack={vi.fn()}
                onCoverContextMenu={vi.fn()}
                trackerCoverAvailable
                coverSource="tracker"
                onCoverSourceChange={onCoverSourceChange}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: home.gallery.details.coverSourceAnilist }));
        expect(onCoverSourceChange).toHaveBeenCalledWith("library");
    });

    it("hides cover source controls when no tracker image is available", () => {
        renderWithI18n(
            <DetailsHero title="Title" coverSrc="" coverAlt="" onBack={vi.fn()} onCoverContextMenu={vi.fn()} />,
        );
        expect(screen.queryByRole("button", { name: home.gallery.details.coverSourceLibrary })).toBeNull();
        expect(screen.queryByRole("button", { name: home.gallery.details.coverSourceAnilist })).toBeNull();
    });
});
