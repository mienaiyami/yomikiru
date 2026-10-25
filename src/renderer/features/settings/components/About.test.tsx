import settings from "@common/i18n/locales/en/settings.json";
import { renderWithProviders } from "@test/renderWithProviders";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import About from "./About";

vi.mock("../../../App", () => ({
    useAppContext: () => ({ setOptSelectData: vi.fn() }),
}));

describe("About reinstall", () => {
    it("puts the reinstall hint on data-tooltip", () => {
        renderWithProviders(<About />);
        const reinstall = screen.getByRole("button", { name: settings.about.reinstall });
        expect(reinstall).toHaveAttribute("data-tooltip", settings.about.reinstallHint);
        expect(reinstall).not.toHaveAttribute("title");
    });
});
