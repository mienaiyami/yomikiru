import home from "@common/i18n/locales/en/home.json";
import { renderWithI18n } from "@test/renderWithProviders";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GalleryTrackingFilterBar from "./GalleryTrackingFilterBar";

describe("GalleryTrackingFilterBar", () => {
    it("cycles from all to tracked to untracked and back to all", () => {
        const onFilterChange = vi.fn();
        const { rerender } = renderWithI18n(
            <GalleryTrackingFilterBar trackingFilter="all" onFilterChange={onFilterChange} />,
        );

        const allButton = screen.getByRole("button", { name: home.gallery.trackingFilter.all.ariaLabel });
        expect(allButton).toHaveAttribute("data-tooltip", home.gallery.trackingFilter.all.tooltip);
        fireEvent.click(allButton);
        expect(onFilterChange).toHaveBeenLastCalledWith("tracked");

        rerender(<GalleryTrackingFilterBar trackingFilter="tracked" onFilterChange={onFilterChange} />);
        fireEvent.click(screen.getByRole("button", { name: home.gallery.trackingFilter.tracked.ariaLabel }));
        expect(onFilterChange).toHaveBeenLastCalledWith("untracked");

        rerender(<GalleryTrackingFilterBar trackingFilter="untracked" onFilterChange={onFilterChange} />);
        fireEvent.click(screen.getByRole("button", { name: home.gallery.trackingFilter.untracked.ariaLabel }));
        expect(onFilterChange).toHaveBeenLastCalledWith("all");
    });
});
