import { setReaderLoading } from "@store/reader";
import { renderWithProviders } from "@test/renderWithProviders";
import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoadingScreen from "./LoadingScreen";

describe("LoadingScreen", () => {
    it("hides when reader.loading is null", () => {
        const { container } = renderWithProviders(<LoadingScreen />);
        expect(container.querySelector("#loadingScreen")).toHaveStyle({ display: "none" });
        expect(container.querySelector(".loadingText")).toBeNull();
    });

    it("shows message and percent bar while loading", () => {
        const { store, container, getByText } = renderWithProviders(<LoadingScreen />);
        act(() => {
            store.dispatch(setReaderLoading({ percent: 40, message: "EXTRACTING" }));
        });
        expect(container.querySelector("#loadingScreen")).toHaveStyle({ display: "grid" });
        expect(getByText("EXTRACTING")).toBeInTheDocument();
        expect(container.querySelector(".loadingBar")).toHaveStyle({ width: "40%" });
    });
});
