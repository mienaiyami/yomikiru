import anilistEn from "@common/i18n/locales/en/anilist.json";
import common from "@common/i18n/locales/en/common.json";
import home from "@common/i18n/locales/en/home.json";
import settings from "@common/i18n/locales/en/settings.json";
import { makeBookItem } from "@test/fixtures/libraryItem";
import { stubFs } from "@test/mocks/preload";
import { renderWithProviders } from "@test/renderWithProviders";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import dateUtils from "@utils/date";
import { afterEach, describe, expect, it, vi } from "vitest";
import BookDetailsPanel from "./BookDetailsPanel";

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

const emptyAnilist = {
    token: null as string | null,
    currentListEntry: null,
    galleryTrackContext: null,
};

const emptyTrackers = {
    entries: [] as [],
    coverCacheGeneration: 0,
};

/**
 * Marks the library EPUB path as present so Continue/Start is enabled.
 */
const stubBookOnDisk = (): void => {
    stubFs({
        existsSync: () => true,
        isDir: () => false,
        isFile: () => true,
    });
};

/**
 * Renders {@link BookDetailsPanel} with a library row in Redux.
 */
const renderBookPanel = (
    item = makeBookItem(),
    options: { anilistToken?: string | null; onClose?: () => void } = {},
) => {
    const onClose = options.onClose ?? vi.fn();
    const utils = renderWithProviders(<BookDetailsPanel bookLink={item.link} onClose={onClose} />, {
        preloadedState: {
            library: { items: { [item.link]: item }, metadata: {}, loading: false, error: null },
            anilist: { ...emptyAnilist, token: options.anilistToken ?? null },
            trackers: { ...emptyTrackers },
        },
    });
    return { ...utils, onClose, item };
};

describe("BookDetailsPanel", () => {
    afterEach(() => {
        cleanup();
        openInReader.mockClear();
        vi.mocked(window.electron.showItemInFolder).mockClear();
    });

    it("calls onClose from the cover back control", () => {
        stubBookOnDisk();
        const { onClose } = renderBookPanel();
        fireEvent.click(screen.getByRole("button", { name: home.gallery.details.backToGallery }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("switches the shared details shell to horizontal view from the list toolbar", () => {
        stubBookOnDisk();
        const { container } = renderBookPanel();

        fireEvent.click(screen.getByRole("button", { name: home.gallery.details.useHorizontalLayout }));

        expect(container.querySelector(".details-layout")).toHaveClass("is-horizontal");
        expect(screen.getByTitle(home.gallery.details.resizeMetaHorizontal)).toBeInTheDocument();
    });

    it("continues at the stored chapter and position", () => {
        stubBookOnDisk();
        const item = makeBookItem();
        renderBookPanel(item);
        fireEvent.click(screen.getByRole("button", { name: home.shared.continueReading }));
        expect(openInReader).toHaveBeenCalledWith(item.link, {
            epubChapterId: item.progress?.chapterId,
            epubElementQueryString: item.progress?.position,
        });
    });

    it("focuses Continue Reading when the panel opens", () => {
        stubBookOnDisk();
        renderBookPanel();
        expect(screen.getByRole("button", { name: home.shared.continueReading })).toHaveFocus();
    });

    it("swaps Copy Path to Copied after writing the library path", () => {
        stubBookOnDisk();
        const writeText = vi.spyOn(window.electron, "writeText");
        const { item } = renderBookPanel();
        fireEvent.click(screen.getByRole("button", { name: common.contextMenu.copyPath }));
        expect(writeText).toHaveBeenCalledWith(item.link);
        expect(screen.getByRole("button", { name: settings.shared.copied })).toBeInTheDocument();
        writeText.mockRestore();
    });

    it("leaves note edit mode on Escape and keeps the typed text", () => {
        stubBookOnDisk();
        renderBookPanel();
        fireEvent.click(screen.getByRole("button", { name: home.gallery.details.itemNote }));
        const editor = screen.getByRole("textbox", { name: home.gallery.details.itemNote });
        fireEvent.change(editor, { target: { value: "keep me" } });
        fireEvent.keyDown(editor, { key: "Escape" });
        expect(screen.queryByRole("textbox", { name: home.gallery.details.itemNote })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: home.gallery.details.itemNote })).toHaveTextContent("keep me");
    });

    it("starts the book when there is no progress", () => {
        stubBookOnDisk();
        const item = makeBookItem({}, null);
        renderBookPanel(item);
        fireEvent.click(screen.getByRole("button", { name: home.shared.startReading }));
        expect(openInReader).toHaveBeenCalledWith(item.link, undefined);
    });

    it("shows current chapter and last-read date without page or chapters-read", () => {
        stubBookOnDisk();
        const item = makeBookItem();
        const lastRead = dateUtils.format(item.progress?.lastReadAt, {
            format: dateUtils.presets.dateTime,
        });
        renderBookPanel(item);
        expect(screen.getByText(home.gallery.details.currentChapter)).toBeInTheDocument();
        expect(screen.getByText("Chapter 1")).toBeInTheDocument();
        expect(screen.getByText(home.gallery.details.lastRead)).toBeInTheDocument();
        expect(screen.getByText(lastRead)).toBeInTheDocument();
        expect(screen.getByText(home.shared.epub)).toBeInTheDocument();
        expect(screen.queryByText(home.gallery.details.currentPage)).not.toBeInTheDocument();
        expect(screen.queryByText(home.gallery.details.chaptersRead)).not.toBeInTheDocument();
        expect(screen.queryByText(home.gallery.details.author)).not.toBeInTheDocument();
        expect(screen.queryByText(home.gallery.details.about)).not.toBeInTheDocument();
        expect(screen.getByText(home.gallery.details.itemNote)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(home.gallery.details.searchBookmarks)).toBeInTheDocument();
    });

    it("turns the item note into an editor when the note body is clicked", () => {
        stubBookOnDisk();
        renderBookPanel();
        fireEvent.click(screen.getByRole("button", { name: home.gallery.details.itemNote }));
        expect(screen.getByRole("textbox", { name: home.gallery.details.itemNote })).toBeInTheDocument();
    });

    it("reveals the library path from the hero Show in File Explorer control", () => {
        stubBookOnDisk();
        const { item } = renderBookPanel();
        fireEvent.click(screen.getByRole("button", { name: common.contextMenu.showInExplorer }));
        expect(window.electron.showItemInFolder).toHaveBeenCalledWith(item.link);
    });

    it("shows disabled Track without a token and an enabled Track with one", () => {
        stubBookOnDisk();
        const { unmount } = renderBookPanel();
        const loggedOut = screen.getByRole("button", { name: anilistEn.bar.track });
        expect(loggedOut).toBeDisabled();
        expect(loggedOut.closest("[data-tooltip]")).toHaveAttribute(
            "data-tooltip",
            anilistEn.bar.loginToTrackHint,
        );
        unmount();
        renderBookPanel(makeBookItem(), { anilistToken: "token" });
        const loggedIn = screen.getByRole("button", { name: anilistEn.bar.track });
        expect(loggedIn).toBeEnabled();
        expect(loggedIn.closest("[data-tooltip]")).toHaveAttribute(
            "data-tooltip",
            anilistEn.bar.trackForMetadataHint,
        );
    });

    it("shows the missing-path banner while bookmark search stays mounted", () => {
        const item = makeBookItem();
        renderBookPanel(item);
        expect(screen.getByText(home.gallery.missing.title)).toBeInTheDocument();
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText(item.link)).toBeInTheDocument();
        const alert = screen.getByRole("alert");
        const hero = document.querySelector(".details-hero");
        expect(hero).toBeInstanceOf(HTMLElement);
        if (!(hero instanceof HTMLElement)) throw new Error("expected .details-hero");
        expect((alert.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true);
        expect(screen.getByPlaceholderText(home.gallery.details.searchBookmarks)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: home.shared.continueReading })).not.toBeInTheDocument();
    });
});
