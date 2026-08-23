/**
 * DB/node Vitest project: install the main-process library Io so common
 * folder/format helpers can run without the renderer preload setup.
 *
 * Also stub `@electron/remote/main` so importing main i18n / MainSettings
 * (which pull WindowManager) does not require Electron's remote native layout
 * under plain Node Vitest.
 */
import { vi } from "vitest";

vi.mock("@electron/remote/main", () => ({
    initialize: vi.fn(),
    enable: vi.fn(),
}));

import "@electron/util/libraryFs";
