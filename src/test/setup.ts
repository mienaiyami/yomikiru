/* Ensure CJS deps (react, RTK) see NODE_ENV before they load. */
process.env.NODE_ENV ??= "test";

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, vi } from "vitest";
import { installPreloadMocks, resetPreloadMocks } from "./mocks/preload";

/* Must run before any `@renderer/*` import that creates a Logger (e.g. i18n). */
installPreloadMocks();

/* dialogUtils / libraryMissingPath resolve copy via i18n; init once for the unit project */
beforeAll(async () => {
    const { default: i18n, initRendererI18n } = await import("@renderer/i18n");
    if (!i18n.isInitialized) {
        await initRendererI18n();
    }
});

afterEach(() => {
    resetPreloadMocks();
    vi.clearAllMocks();
    /* reinstall so per-test window.fs / electron overrides do not leak */
    installPreloadMocks();
});
