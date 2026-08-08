import { onInvoke } from "@test/mocks/preload";
import { renderWithProviders } from "@test/renderWithProviders";
import { fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Link from "./Link";

describe("Link", () => {
    it("opens external URL after confirm dialog accepts", async () => {
        onInvoke("dialog:confirm", async () => ({
            response: 0,
            checkboxChecked: false,
        }));
        const openExternal = vi.mocked(window.electron.openExternal);

        const { getByText } = renderWithProviders(
            <Link href="https://example.com" confirmOpen>
                Example
            </Link>,
        );

        fireEvent.click(getByText("Example"));

        await waitFor(() => {
            expect(openExternal).toHaveBeenCalledWith("https://example.com");
        });
    });

    it("skips confirm when confirmOpen is false", () => {
        const openExternal = vi.mocked(window.electron.openExternal);
        const { getByText } = renderWithProviders(
            <Link href="https://direct.test" confirmOpen={false}>
                Direct
            </Link>,
        );

        fireEvent.click(getByText("Direct"));
        expect(openExternal).toHaveBeenCalledWith("https://direct.test");
    });
});
