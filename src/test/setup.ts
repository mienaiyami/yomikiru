/* Ensure CJS deps (react, RTK) see NODE_ENV before they load. */
process.env.NODE_ENV ??= "test";

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, vi } from "vitest";
import { installPreloadMocks, resetPreloadMocks } from "./mocks/preload";

/* Must run before any `@renderer/*` import that creates a Logger (e.g. i18n). */
installPreloadMocks();

/*
 * Bundled catalogs + initReactI18next once for the unit project. Tests that
 * call useTranslation should render via renderWithI18n / renderWithProviders.
 */
beforeAll(async () => {
    const { default: i18n, initRendererI18n } = await import("@renderer/i18n");
    if (!i18n.isInitialized) {
        await initRendererI18n();
    }
});

afterEach(() => {
    cleanup();
    resetPreloadMocks();
    vi.clearAllMocks();
    /* reinstall so per-test window.fs / electron overrides do not leak */
    installPreloadMocks();
});
