import path from "node:path";
import common from "@common/i18n/locales/en/common.json";
import home from "@common/i18n/locales/en/home.json";
import type { LibraryItemMetadata } from "@common/types/db";
import { onInvoke } from "@test/mocks/preload";
import { renderWithProviders } from "@test/renderWithProviders";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ItemMetadataEditor } from "./ItemMetadataEditor";

const itemLink = path.join("library", "series");

/** User overlay fixture for the metadata editor. */
const userOverlay: LibraryItemMetadata = {
    itemLink,
    source: "user",
    title: "T",
    author: null,
    description: null,
    genres: null,
    tags: null,
    publisher: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
};

describe("ItemMetadataEditor", () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it("wires a separate label per field", () => {
        renderWithProviders(
            <ItemMetadataEditor itemLink={itemLink} userOverlay={userOverlay} onClose={vi.fn()} />,
        );
        expect(screen.getByLabelText(home.gallery.details.metadataTitle)).toBeInTheDocument();
        expect(screen.getByLabelText(home.gallery.details.metadataAuthor)).toBeInTheDocument();
        expect(screen.getByLabelText(home.gallery.details.metadataDescription)).toBeInTheDocument();
        expect(screen.getByLabelText(home.gallery.details.metadataGenres)).toBeInTheDocument();
        expect(screen.getByText(home.gallery.details.metadataAnilistHint)).toBeInTheDocument();
    });

    it("lets Space and letter keys reach text fields without preventDefault", () => {
        renderWithProviders(
            <ItemMetadataEditor itemLink={itemLink} userOverlay={userOverlay} onClose={vi.fn()} />,
        );
        const title = screen.getByLabelText(home.gallery.details.metadataTitle);
        const description = screen.getByLabelText(home.gallery.details.metadataDescription);
        expect(fireEvent.keyDown(title, { key: " ", code: "Space" })).toBe(true);
        expect(fireEvent.keyDown(title, { key: "h", code: "KeyH" })).toBe(true);
        expect(fireEvent.keyDown(description, { key: " ", code: "Space" })).toBe(true);
    });

    it("does not bubble field keydowns to window", () => {
        renderWithProviders(
            <ItemMetadataEditor itemLink={itemLink} userOverlay={userOverlay} onClose={vi.fn()} />,
        );
        const onWindow = vi.fn();
        window.addEventListener("keydown", onWindow);
        try {
            fireEvent.keyDown(screen.getByLabelText(home.gallery.details.metadataTitle), {
                key: "h",
                code: "KeyH",
            });
            fireEvent.keyDown(screen.getByLabelText(home.gallery.details.metadataAuthor), {
                key: " ",
                code: "Space",
            });
            expect(onWindow).not.toHaveBeenCalled();
        } finally {
            window.removeEventListener("keydown", onWindow);
        }
    });

    it("swaps Save to Saving then Saved and closes after success", async () => {
        let resolveSave: (row: LibraryItemMetadata | null) => void = () => {
            /* replaced when the deferred setMetadata promise is created */
        };
        onInvoke(
            "db:library:setMetadata",
            () =>
                new Promise<LibraryItemMetadata | null>((resolve) => {
                    resolveSave = resolve;
                }),
        );
        const onClose = vi.fn();
        renderWithProviders(
            <ItemMetadataEditor itemLink={itemLink} userOverlay={userOverlay} onClose={onClose} />,
        );
        fireEvent.click(screen.getByRole("button", { name: common.actions.save }));
        expect(await screen.findByRole("button", { name: common.actions.saving })).toBeDisabled();
        resolveSave(userOverlay);
        expect(await screen.findByRole("button", { name: common.actions.saved })).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 2500 });
    });

    it("shows Failed when the metadata IPC returns null", async () => {
        onInvoke("db:library:setMetadata", async () => null);
        renderWithProviders(
            <ItemMetadataEditor itemLink={itemLink} userOverlay={userOverlay} onClose={vi.fn()} />,
        );
        fireEvent.click(screen.getByRole("button", { name: common.actions.save }));
        await waitFor(() => {
            expect(screen.getByRole("button", { name: common.actions.failed })).toBeInTheDocument();
        });
    });

    it("disables Reset when the overlay and form are empty", () => {
        renderWithProviders(<ItemMetadataEditor itemLink={itemLink} onClose={vi.fn()} />);
        expect(screen.getByRole("button", { name: common.actions.reset })).toBeDisabled();
    });

    it("asks before resetting overlay fields and writes nulls", async () => {
        onInvoke("dialog:confirm", async () => ({ response: 0, checkboxChecked: false }));
        const setMetadata = vi.fn(async () => ({ ...userOverlay, title: null }));
        onInvoke("db:library:setMetadata", setMetadata);
        const onClose = vi.fn();
        renderWithProviders(
            <ItemMetadataEditor itemLink={itemLink} userOverlay={userOverlay} onClose={onClose} />,
        );
        fireEvent.click(screen.getByRole("button", { name: common.actions.reset }));
        await waitFor(() =>
            expect(setMetadata).toHaveBeenCalledWith(
                expect.objectContaining({
                    itemLink,
                    source: "user",
                    title: null,
                    author: null,
                    description: null,
                    genres: null,
                }),
            ),
        );
        expect(await screen.findByRole("button", { name: common.actions.saved })).toBeInTheDocument();
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 2500 });
    });

    it("does not write metadata when reset is cancelled", async () => {
        const confirm = vi.fn(async () => ({ response: 1, checkboxChecked: false }));
        onInvoke("dialog:confirm", confirm);
        const setMetadata = vi.fn();
        onInvoke("db:library:setMetadata", setMetadata);
        renderWithProviders(
            <ItemMetadataEditor itemLink={itemLink} userOverlay={userOverlay} onClose={vi.fn()} />,
        );
        fireEvent.click(screen.getByRole("button", { name: common.actions.reset }));
        await waitFor(() => expect(confirm).toHaveBeenCalled());
        expect(setMetadata).not.toHaveBeenCalled();
    });

    it("clears unsaved form fields without IPC after reset confirm", async () => {
        const confirm = vi.fn(async () => ({ response: 0, checkboxChecked: false }));
        onInvoke("dialog:confirm", confirm);
        const setMetadata = vi.fn();
        onInvoke("db:library:setMetadata", setMetadata);
        const onClose = vi.fn();
        renderWithProviders(<ItemMetadataEditor itemLink={itemLink} onClose={onClose} />);
        fireEvent.change(screen.getByLabelText(home.gallery.details.metadataTitle), {
            target: { value: "Draft" },
        });
        fireEvent.click(screen.getByRole("button", { name: common.actions.reset }));
        await waitFor(() => expect(confirm).toHaveBeenCalled());
        expect(setMetadata).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
