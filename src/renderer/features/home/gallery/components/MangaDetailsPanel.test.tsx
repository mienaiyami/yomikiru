import anilistEn from "@common/i18n/locales/en/anilist.json";
import common from "@common/i18n/locales/en/common.json";
import home from "@common/i18n/locales/en/home.json";
import settings from "@common/i18n/locales/en/settings.json";
import { makeMangaItem } from "@test/fixtures/libraryItem";
import { stubFs } from "@test/mocks/preload";
import { renderWithProviders } from "@test/renderWithProviders";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import dateUtils from "@utils/date";
import { resolveMangaChapterPath } from "@utils/mangaChapterPath";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DETAILS_HERO_SYNOPSIS_PREVIEW } from "./DetailsHero";
import MangaDetailsPanel from "./MangaDetailsPanel";

const { openInReader } = vi.hoisted(() => ({
    openInReader: vi.fn(),
}));

vi.mock("./mangaDetailsPanel.scss", () => ({}));

vi.mock("@renderer/App", () => ({
    useAppContext: () => ({
        openInReader,
        setContextMenuData: vi.fn(),
    }),
}));

vi.mock("@utils/libraryCoverService", async (importOriginal) => {
    const mod = await importOriginal<typeof import("@utils/libraryCoverService")>();
    return {
        ...mod,
        materializeMangaLibraryThumbnail: vi.fn(async () => false),
    };
});

const emptyAnilist = {
    token: null as string | null,
    tracking: [] as Anilist.TrackStore,
    currentManga: null,
    galleryTrackContext: null,
};

/**
 * Marks the library manga path as present so Continue works and the missing-path banner stays hidden.
 */
const stubMangaOnDisk = (): void => {
    stubFs({
        existsSync: () => true,
        isDir: () => true,
        isFile: () => false,
        readdir: async () => [],
        access: async () => undefined,
        stat: async () =>
            ({
                mtimeMs: 1,
                isDir: true,
                isFile: false,
            }) as Awaited<ReturnType<Window["fs"]["stat"]>>,
    });
};

/**
 * Renders {@link MangaDetailsPanel} with a library row in Redux.
 */
const renderMangaPanel = (
    item = makeMangaItem(),
    options: { anilistToken?: string | null; onClose?: () => void } = {},
) => {
    const onClose = options.onClose ?? vi.fn();
    const utils = renderWithProviders(<MangaDetailsPanel mangaLink={item.link} onClose={onClose} />, {
        preloadedState: {
            library: { items: { [item.link]: item }, loading: false, error: null },
            anilist: { ...emptyAnilist, token: options.anilistToken ?? null },
        },
    });
    return { ...utils, onClose, item };
};

/** Drains the async chapter scan so unmount does not warn about setState. */
const waitForEmptyChapterList = () =>
    waitFor(() => {
        expect(screen.getByText(home.gallery.details.noChapters)).toBeInTheDocument();
    });

describe("MangaDetailsPanel", () => {
    afterEach(() => {
        cleanup();
        openInReader.mockClear();
        vi.mocked(window.electron.showItemInFolder).mockClear();
    });

    it("calls onClose from the cover back control", async () => {
        stubMangaOnDisk();
        const { onClose } = renderMangaPanel();
        fireEvent.click(screen.getByRole("button", { name: home.gallery.details.backToGallery }));
        expect(onClose).toHaveBeenCalledTimes(1);
        await waitForEmptyChapterList();
    });

    it("exposes the metadata resizer with the resize label", async () => {
        stubMangaOnDisk();
        renderMangaPanel();
        expect(screen.getByTitle(home.gallery.details.resizeMeta)).toBeInTheDocument();
        await waitForEmptyChapterList();
    });

    it("continues at the stored chapter and page", async () => {
        stubMangaOnDisk();
        const item = makeMangaItem();
        renderMangaPanel(item);
        fireEvent.click(screen.getByRole("button", { name: home.shared.continueReading }));
        expect(openInReader).toHaveBeenCalledWith(
            resolveMangaChapterPath(item.link, item.progress?.chapterName ?? ""),
            { mangaPageNumber: item.progress?.currentPage },
        );
        await waitForEmptyChapterList();
    });

    it("disables locate current chapter when there is no progress", async () => {
        stubMangaOnDisk();
        renderMangaPanel(makeMangaItem({}, null));
        expect(screen.getByRole("button", { name: home.gallery.details.locateCurrentChapter })).toBeDisabled();
        await waitForEmptyChapterList();
    });

    it("scrolls the current chapter in the content list without moving ancestor scrollers", async () => {
        const item = makeMangaItem();
        const chapterName = item.progress?.chapterName ?? "ch1";
        stubFs({
            existsSync: () => true,
            isDir: () => true,
            isFile: () => false,
            readdir: async (dir) => (dir === item.link ? [chapterName] : ["01.png"]),
            access: async () => undefined,
            stat: async () =>
                ({
                    mtimeMs: 1,
                    isDir: true,
                    isFile: false,
                }) as Awaited<ReturnType<Window["fs"]["stat"]>>,
        });
        /* happy-dom may omit Element.scrollIntoView; stub so the spy can assert locate does not use it */
        HTMLElement.prototype.scrollIntoView ??= () => undefined;
        const scrollIntoView = vi
            .spyOn(HTMLElement.prototype, "scrollIntoView")
            .mockImplementation(() => undefined);
        renderMangaPanel(item);
        await waitFor(() => {
            expect(screen.getByText(chapterName)).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole("button", { name: home.gallery.details.locateCurrentChapter }));
        expect(scrollIntoView).not.toHaveBeenCalled();
        scrollIntoView.mockRestore();
    });

    it("focuses Continue Reading when the panel opens", async () => {
        stubMangaOnDisk();
        renderMangaPanel();
        expect(screen.getByRole("button", { name: home.shared.continueReading })).toHaveFocus();
        await waitForEmptyChapterList();
    });

    it("swaps Copy Path to Copied after writing the library path", async () => {
        stubMangaOnDisk();
        const writeText = vi.spyOn(window.electron, "writeText");
        const { item } = renderMangaPanel();
        fireEvent.click(screen.getByRole("button", { name: common.contextMenu.copyPath }));
        expect(writeText).toHaveBeenCalledWith(item.link);
        expect(screen.getByRole("button", { name: settings.shared.copied })).toBeInTheDocument();
        writeText.mockRestore();
        await waitForEmptyChapterList();
    });

    it("leaves note edit mode on Escape and keeps the typed text", async () => {
        stubMangaOnDisk();
        renderMangaPanel();
        fireEvent.click(screen.getByRole("button", { name: home.gallery.details.itemNote }));
        const editor = screen.getByRole("textbox", { name: home.gallery.details.itemNote });
        fireEvent.change(editor, { target: { value: "keep me" } });
        fireEvent.keyDown(editor, { key: "Escape" });
        expect(screen.queryByRole("textbox", { name: home.gallery.details.itemNote })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: home.gallery.details.itemNote })).toHaveTextContent("keep me");
        await waitForEmptyChapterList();
    });

    it("starts from the manga folder when there is no progress", async () => {
        stubMangaOnDisk();
        const item = makeMangaItem({}, null);
        renderMangaPanel(item);
        fireEvent.click(screen.getByRole("button", { name: home.shared.startReading }));
        expect(openInReader).toHaveBeenCalledWith(item.link);
        await waitForEmptyChapterList();
    });

    it("shows current chapter name, last-read date, and chapters-read as read / total", async () => {
        stubMangaOnDisk();
        const item = makeMangaItem();
        const lastRead = dateUtils.format(item.progress?.lastReadAt, {
            format: dateUtils.presets.dateTime,
        });
        renderMangaPanel(item);
        expect(screen.getByText(home.gallery.details.currentChapter)).toBeInTheDocument();
        expect(screen.getByText("ch1")).toBeInTheDocument();
        expect(screen.getByText(home.gallery.details.lastRead)).toBeInTheDocument();
        expect(screen.getByText(lastRead)).toBeInTheDocument();
        expect(
            screen.getByText(`${item.progress?.currentPage} / ${item.progress?.totalPages}`),
        ).toBeInTheDocument();
        expect(screen.getByText(home.gallery.details.chaptersRead)).toBeInTheDocument();
        expect(screen.getByText("0 / 0")).toBeInTheDocument();
        expect(screen.queryByText(home.gallery.details.author)).not.toBeInTheDocument();
        expect(screen.queryByText(home.gallery.details.editNote)).not.toBeInTheDocument();
        if (DETAILS_HERO_SYNOPSIS_PREVIEW) {
            const factsMain = document.querySelector(".details-facts-main");
            const about = screen.getByText(home.gallery.details.about);
            expect(factsMain?.contains(about)).toBe(true);
            expect(
                (screen.getByText(home.gallery.details.currentChapter).compareDocumentPosition(about) &
                    Node.DOCUMENT_POSITION_FOLLOWING) !==
                    0,
            ).toBe(true);
            expect(factsMain?.contains(screen.getByText(home.gallery.details.genresPreview))).toBe(true);
        } else {
            expect(screen.queryByText(home.gallery.details.about)).not.toBeInTheDocument();
        }
        await waitForEmptyChapterList();
    });

    it("renders the author name when the library row has one", async () => {
        stubMangaOnDisk();
        renderMangaPanel(makeMangaItem({ author: "Eiichiro Oda" }));
        expect(screen.getByText("Eiichiro Oda")).toBeInTheDocument();
        await waitForEmptyChapterList();
    });

    it("hides compact AniList without a token and shows Track with one", async () => {
        stubMangaOnDisk();
        const { unmount } = renderMangaPanel();
        expect(screen.queryByRole("button", { name: anilistEn.bar.track })).not.toBeInTheDocument();
        await waitForEmptyChapterList();
        unmount();
        renderMangaPanel(makeMangaItem(), { anilistToken: "token" });
        expect(screen.getByRole("button", { name: anilistEn.bar.track })).toBeInTheDocument();
        await waitForEmptyChapterList();
    });

    it("shows the missing-path banner while the list toolbar stays mounted", async () => {
        const item = makeMangaItem();
        renderMangaPanel(item);
        expect(screen.getByText(home.gallery.missing.title)).toBeInTheDocument();
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText(item.link)).toBeInTheDocument();
        const alert = screen.getByRole("alert");
        const hero = document.querySelector(".details-hero");
        expect(hero).toBeTruthy();
        expect((alert.compareDocumentPosition(hero!) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true);
        await waitForEmptyChapterList();
        expect(screen.getByPlaceholderText(home.gallery.details.searchChapters)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: home.gallery.details.content })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: home.shared.continueReading })).not.toBeInTheDocument();
    });

    it("keeps tabs on the left and search on the gallery toolbar chrome", async () => {
        stubMangaOnDisk();
        renderMangaPanel();
        const toolbar = document.querySelector(".galleryToolbar");
        expect(toolbar).toBeTruthy();
        const tabs = toolbar?.querySelector(".galleryTabBar");
        const search = toolbar?.querySelector(".search");
        const actions = toolbar?.querySelector(".actions");
        expect(tabs).toBeTruthy();
        expect(search).toBeTruthy();
        expect(actions).toBeTruthy();
        expect(
            Boolean(
                tabs && search && (tabs.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
            ),
        ).toBe(true);
        expect(
            Boolean(
                actions &&
                    search &&
                    (actions.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
            ),
        ).toBe(true);
        expect(screen.getByRole("button", { name: home.gallery.details.content })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: home.gallery.details.bookmarks })).toBeInTheDocument();
        await waitForEmptyChapterList();
    });

    it("turns the item note into an editor when the note body is clicked", async () => {
        stubMangaOnDisk();
        renderMangaPanel();
        expect(screen.getByText(home.gallery.details.itemNote)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: home.gallery.details.itemNote }));
        expect(screen.getByRole("textbox", { name: home.gallery.details.itemNote })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: home.gallery.details.editNote })).not.toBeInTheDocument();
        await waitForEmptyChapterList();
    });

    it("reveals the library path from the hero Show in File Explorer control", async () => {
        stubMangaOnDisk();
        const { item } = renderMangaPanel();
        fireEvent.click(screen.getByRole("button", { name: common.contextMenu.showInExplorer }));
        expect(window.electron.showItemInFolder).toHaveBeenCalledWith(item.link);
        await waitForEmptyChapterList();
    });
});
