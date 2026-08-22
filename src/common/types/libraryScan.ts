/**
 * Shared library-scan progress DTO (title bar, Scan now, IPC).
 * Timing/depth constants used by the main-process scan engine.
 */

/** Classify / add / catalogue-refresh stages of a library scan. */
export type LibraryScanPhase = "walking" | "adding" | "refreshing";

/** Live scan progress. `null` on the wire means idle. */
export type LibraryScanStatus = {
    phase: LibraryScanPhase;
    /** 1-based index of the root currently being walked. */
    rootIndex: number;
    rootCount: number;
    rootPath: string;
    currentPath: string;
    added: number;
    skipped: number;
    failed: number;
    addIndex: number;
    addTotal: number;
};

/** Why a catalogue walk was requested. `watch` does not stamp lastScanAtMs. */
export type LibraryScanReason = "manual" | "startup" | "interval" | "watch";

/** Renderer / scheduler request to start a process-wide scan. */
export type LibraryScanStartRequest = {
    reason: LibraryScanReason;
    /**
     * When set, only these MainSettings folder paths are walked (Scan this folder).
     * Omitted: reason selects roots (manual = every existing path).
     */
    paths?: string[];
};

/** Outcome of {@link LibraryScanStartRequest}. `started: false` means idle or already running. */
export type LibraryScanStartResult = {
    started: boolean;
    cancelled: boolean;
    added: number;
    skipped: number;
    failed: number;
};

/**
 * How often main asks the host window whether an interval scan is due.
 * User-facing spacing is per-folder interval minutes, not this poll.
 */
export const LIBRARY_SCAN_INTERVAL_POLL_MS = 60_000;

/**
 * How long watch events sit before classify-upward runs.
 * ponytail: coalesces copy/extract bursts; upgrade: longer quiet window or ignore incomplete folders.
 */
export const LIBRARY_FOLDER_WATCH_DEBOUNCE_MS = 2000;

/**
 * Extra chokidar depth past a folder's maxDepth so chapter page files still fire events.
 * Ceiling plus this is the named watch-depth bound.
 */
export const LIBRARY_FOLDER_WATCH_DEPTH_PAD = 3;

/**
 * Hard cap on grouping-folder recursion for library scan, regardless of caller maxDepth.
 */
export const LIBRARY_SCAN_MAX_DEPTH_CEILING = 12;

/**
 * Default grouping-folder steps for a new library-folder row.
 * The walk ceiling stays {@link LIBRARY_SCAN_MAX_DEPTH_CEILING}.
 */
export const LIBRARY_SCAN_DEFAULT_MAX_DEPTH = 2;

/**
 * Clamps a grouping-folder walk depth to `0`..{@link LIBRARY_SCAN_MAX_DEPTH_CEILING}.
 * Used by Settings inputs and by scan-root builders before classify.
 */
export const clampLibraryScanMaxDepth = (value: number): number =>
    Math.min(LIBRARY_SCAN_MAX_DEPTH_CEILING, Math.max(0, Math.round(value)));
