import path from "node:path";
import anilistEn from "@common/i18n/locales/en/anilist.json";
import type { ItemTracker } from "@common/types/db";
import { onInvoke } from "@test/mocks/preload";
import { renderWithProviders } from "@test/renderWithProviders";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { searchAnilistMedia } from "@utils/anilist";
import { healShortcutEntries } from "@utils/keybindings";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AnilistSearch from "./AnilistSearch";

vi.mock("react-focus-lock", () => ({
    default: ({ children }: { children: unknown }) => children,
}));

vi.mock("@utils/anilist", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@utils/anilist")>();
    return {
        ...actual,
        searchAnilistMedia: vi.fn(),
    };
});

const itemLink = path.join("library", "tracked");
const defaultShortcuts = { shortcuts: healShortcutEntries([]) };

/** Minimal AniList search hit used as {@link searchAnilistMedia} payload. */
const searchHit = (id: number, english: string): Anilist.SearchMediaItem => ({
    id,
    idMal: null,
    title: { english, romaji: english, native: english },
    startDate: { year: 2020, month: 1, day: 1 },
    format: "MANGA",
    coverImage: { medium: "m" },
    status: "RELEASING",
});

/** Tracker row returned by the stubbed upsert IPC. */
const trackerRow = (remoteId: string): ItemTracker => ({
    id: 1,
    itemLink,
    provider: "anilist",
    remoteId,
    remoteListId: null,
    remoteUrl: null,
    media: null,
    listState: null,
    syncedAt: null,
    createdAt: new Date(0),
});

/** Result `<li>` for an English title in the Add Tracking list. */
const resultItem = (english: string) => {
    const li = screen.getAllByText(english)[0]?.closest("li");
    if (!li) throw new Error(`missing result row for ${english}`);
    return li;
};

/**
 * Overlay open from gallery track context: seeded title, list shortcuts, search flag on.
 */
const renderSearch = () =>
    renderWithProviders(<AnilistSearch />, {
        preloadedState: {
            ...defaultShortcuts,
            anilist: {
                token: "token",
                currentListEntry: null,
                galleryTrackContext: { link: itemLink, title: "Seed Title" },
            },
            ui: {
                isOpen: {
                    settings: false,
                    anilist: { login: false, search: true, edit: false },
                },
                pendingSettingsNav: null,
                blocks: [],
            },
        },
    });

describe("AnilistSearch", () => {
    beforeEach(() => {
        vi.mocked(searchAnilistMedia).mockResolvedValue([searchHit(11, "First"), searchHit(22, "Second")]);
        onInvoke("db:trackers:upsert", async (req) => trackerRow(req.remoteId));
    });

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it("searches the seeded title on open and focuses the field", async () => {
        renderSearch();

        await waitFor(() => expect(searchAnilistMedia).toHaveBeenCalledWith("Seed Title"));
        const input = screen.getByPlaceholderText(anilistEn.search.placeholder);
        expect(input).toHaveValue("Seed Title");
        await waitFor(() => expect(input).toHaveFocus());

        await screen.findAllByText("First");
        expect(resultItem("First")).toHaveAttribute("data-focused", "false");
        expect(screen.queryByRole("button", { name: /First/ })).toBeNull();
    });

    it("selects a result with listDown then listSelect and upserts the tracker", async () => {
        const { store } = renderSearch();

        await screen.findAllByText("First");
        const input = screen.getByPlaceholderText(anilistEn.search.placeholder);
        await act(async () => {
            fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
        });
        expect(resultItem("First")).toHaveAttribute("data-focused", "true");
        await act(async () => {
            fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
        });

        await waitFor(() => {
            expect(store.getState().anilist.galleryTrackContext).toBeNull();
            expect(store.getState().ui.isOpen.anilist.search).toBe(false);
        });
        expect(store.getState().trackers.entries).toEqual([
            expect.objectContaining({ itemLink, provider: "anilist", remoteId: "11" }),
        ]);
    });

    it("moves list focus with listDown then links the highlighted result", async () => {
        const { store } = renderSearch();

        await screen.findAllByText("First");
        const input = screen.getByPlaceholderText(anilistEn.search.placeholder);
        await act(async () => {
            fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
            fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
        });
        expect(resultItem("Second")).toHaveAttribute("data-focused", "true");

        await act(async () => {
            fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
        });

        await waitFor(() => {
            expect(store.getState().trackers.entries).toEqual([
                expect.objectContaining({ itemLink, provider: "anilist", remoteId: "22" }),
            ]);
        });
    });

    it("debounces typed queries before calling searchAnilistMedia", async () => {
        renderSearch();
        await waitFor(() => expect(searchAnilistMedia).toHaveBeenCalledWith("Seed Title"));
        vi.mocked(searchAnilistMedia).mockClear();

        vi.useFakeTimers();
        const input = screen.getByPlaceholderText(anilistEn.search.placeholder);
        fireEvent.change(input, { target: { value: "naruto" } });
        expect(searchAnilistMedia).not.toHaveBeenCalled();

        await act(async () => {
            vi.advanceTimersByTime(1000);
        });
        expect(searchAnilistMedia).toHaveBeenCalledWith("naruto");
    });

    it("closes the overlay on Escape from the search field", async () => {
        const { store } = renderSearch();
        await screen.findAllByText("First");

        const input = screen.getByPlaceholderText(anilistEn.search.placeholder);
        await act(async () => {
            fireEvent.keyDown(input, { key: "Escape", code: "Escape" });
        });

        expect(store.getState().ui.isOpen.anilist.search).toBe(false);
        expect(store.getState().anilist.galleryTrackContext).toBeNull();
    });
});
