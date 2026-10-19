import {
    PACK_ALLOWED_NAMESPACES,
    type TranslationPackManifest,
    translationPackManifestSchema,
} from "./packSchema";

/** Result of validating a pack directory layout + manifest. */
export type PackValidationResult =
    | { ok: true; manifest: TranslationPackManifest }
    | { ok: false; message: string };

type PackDirListing = {
    /** File names at pack root (no paths). */
    files: string[];
    /** Directory names at pack root. */
    directories: string[];
};

/**
 * Validates pack layout: flat root, no `locales/` tree, only `pack.json` + listed `<ns>.json`.
 * Pure helper for main-process install and unit tests.
 */
export const validatePackListing = (
    listing: PackDirListing,
    packJsonText: string,
    expectedFolderId?: string,
): PackValidationResult => {
    if (listing.directories.length > 0) {
        return {
            ok: false,
            message: `pack must be flat (one locale); unexpected directories: ${listing.directories.join(", ")}`,
        };
    }

    let raw: unknown;
    try {
        raw = JSON.parse(packJsonText);
    } catch {
        return { ok: false, message: "pack.json is not valid JSON" };
    }

    const parsed = translationPackManifestSchema.safeParse(raw);
    if (!parsed.success) {
        return { ok: false, message: `invalid pack.json: ${parsed.error.issues[0]?.message ?? "schema error"}` };
    }
    const manifest = parsed.data;

    if (expectedFolderId !== undefined && manifest.id !== expectedFolderId) {
        return {
            ok: false,
            message: `pack.json id "${manifest.id}" does not match folder "${expectedFolderId}"`,
        };
    }

    const allowedNsFiles = new Set(manifest.namespaces.map((ns) => `${ns}.json`));
    const allowedFiles = new Set(["pack.json", ...allowedNsFiles]);

    for (const file of listing.files) {
        if (!allowedFiles.has(file)) {
            return { ok: false, message: `unexpected file in pack: ${file}` };
        }
    }

    if (!listing.files.includes("pack.json")) {
        return { ok: false, message: "missing pack.json" };
    }

    for (const ns of manifest.namespaces) {
        if (!PACK_ALLOWED_NAMESPACES.includes(ns)) {
            return { ok: false, message: `namespace not allowed: ${ns}` };
        }
        if (!listing.files.includes(`${ns}.json`)) {
            return { ok: false, message: `missing namespace file: ${ns}.json` };
        }
    }

    return { ok: true, manifest };
};

/**
 * Ensures a parsed namespace JSON root is a plain object suitable for i18next resources.
 */
export const isPlainResourceObject = (value: unknown): value is Record<string, unknown> => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
};
