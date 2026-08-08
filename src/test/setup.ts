/* Ensure CJS deps (react, RTK) see NODE_ENV before they load. */
process.env.NODE_ENV ??= "test";

import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { installPreloadMocks, resetPreloadMocks } from "./mocks/preload";

installPreloadMocks();

afterEach(() => {
    resetPreloadMocks();
    vi.clearAllMocks();
    /* reinstall so per-test window.fs / electron overrides do not leak */
    installPreloadMocks();
});
