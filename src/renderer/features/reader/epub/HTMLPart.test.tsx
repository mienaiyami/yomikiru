import path from "node:path";
import { stubFs } from "@test/mocks/preload";
import { renderWithProviders } from "@test/renderWithProviders";
import { fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HTMLPart from "./HTMLPart";

vi.mock("@renderer/App", () => ({ useAppContext: () => ({ setContextMenuData: vi.fn() }) }));

describe("HTMLPart", () => {
    it("keeps chapter DOM and current link handlers across progress and callback updates", async () => {
        const chapterPath = path.join("book", "chapter.xhtml");
        const readFile = vi.fn(
            async () =>
                '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Reading place</p><a href="#note">Note</a></body></html>',
        );
        stubFs({ existsSync: () => true, readFile });
        const manifest = new Map([
            ["chapter", { id: "chapter", href: chapterPath, mediaType: "application/xhtml+xml" }],
        ]);
        const initialHandler = vi.fn();
        const nextHandler = vi.fn();
        const injected = vi.fn();
        const { container, rerender } = renderWithProviders(
            <HTMLPart
                epubManifest={manifest}
                currentChapter={{ id: "chapter", fragment: "", elementQuery: "" }}
                onEpubLinkClick={initialHandler}
                onHtmlInjected={injected}
            />,
        );
        await waitFor(() => expect(injected).toHaveBeenCalledTimes(1));
        const paragraph = container.querySelector("p");
        rerender(
            <HTMLPart
                epubManifest={manifest}
                currentChapter={{ id: "chapter", fragment: "", elementQuery: "p" }}
                onEpubLinkClick={nextHandler}
                onHtmlInjected={injected}
            />,
        );
        expect(container.querySelector("p")).toBe(paragraph);
        expect(injected).toHaveBeenCalledTimes(1);
        expect(readFile).toHaveBeenCalledTimes(1);
        const link = container.querySelector("a");
        if (!link) throw new Error("Missing chapter link");
        fireEvent.click(link);
        expect(nextHandler).toHaveBeenCalledTimes(1);
        expect(initialHandler).not.toHaveBeenCalled();
    });

    it("declares valid empty chapters ready so navigation does not wait for nonexistent children", async () => {
        stubFs({
            existsSync: () => true,
            readFile: async () => '<html xmlns="http://www.w3.org/1999/xhtml"><body></body></html>',
        });
        const manifest = new Map([
            ["empty", { id: "empty", href: path.join("book", "empty.xhtml"), mediaType: "application/xhtml+xml" }],
        ]);
        const injected = vi.fn();
        const { container } = renderWithProviders(
            <HTMLPart
                epubManifest={manifest}
                currentChapter={{ id: "empty", fragment: "", elementQuery: "" }}
                onEpubLinkClick={vi.fn()}
                onHtmlInjected={injected}
            />,
        );
        await waitFor(() => expect(injected).toHaveBeenCalledWith("empty"));
        expect(container.querySelector("#epub-empty")).toHaveAttribute("data-epub-ready", "true");
    });
});
