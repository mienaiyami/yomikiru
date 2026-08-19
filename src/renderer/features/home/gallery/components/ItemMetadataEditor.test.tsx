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
    });

    it("swaps Save to Saving then Saved and closes after success", async () => {
        let resolveSave: (row: LibraryItemMetadata | null) => void = () => {};
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
});
