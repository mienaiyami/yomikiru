import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import {
    BUILTIN_SOURCES,
    isPlainResourceObject,
    type LanguageSource,
    PACK_ARCHIVE_MAX_BYTES,
    PACK_ID_PATTERN,
    PACK_NS_FILE_MAX_BYTES,
    type PackOverlayMap,
    packSourceId,
    type TranslationPackManifest,
    validatePackListing,
} from "@common/i18n";
import { createMainLogger } from "@electron/util/logger";
import * as crossZip from "cross-zip";
import { app } from "electron";

const logger = createMainLogger("i18n/packs");
const unzip = promisify(crossZip.unzip);
const zip = promisify(crossZip.zip);

/**
 * Returns `{userData}/i18n-packs` (created if missing).
 */
export const getI18nPacksRoot = (): string => {
    const root = path.join(app.getPath("userData"), "i18n-packs");
    fs.mkdirSync(root, { recursive: true });
    return root;
};

const listPackRoot = (dir: string): { files: string[]; directories: string[] } => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return {
        files: entries.filter((e) => e.isFile()).map((e) => e.name),
        directories: entries.filter((e) => e.isDirectory()).map((e) => e.name),
    };
};

/**
 * Reads and validates an extracted pack directory. Ensures namespace JSON files are plain objects.
 */
export const validatePackDirectory = (
    packDir: string,
    expectedFolderId?: string,
): { ok: true; manifest: TranslationPackManifest } | { ok: false; message: string } => {
    const packJsonPath = path.join(packDir, "pack.json");
    if (!fs.existsSync(packJsonPath)) {
        return { ok: false, message: "missing pack.json" };
    }
    const listing = listPackRoot(packDir);
    const packJsonText = fs.readFileSync(packJsonPath, "utf-8");
    const layout = validatePackListing(listing, packJsonText, expectedFolderId);
    if (!layout.ok) return layout;

    for (const ns of layout.manifest.namespaces) {
        const nsPath = path.join(packDir, `${ns}.json`);
        const stat = fs.statSync(nsPath);
        if (stat.size > PACK_NS_FILE_MAX_BYTES) {
            return { ok: false, message: `namespace file too large: ${ns}.json` };
        }
        let parsed: unknown;
        try {
            parsed = JSON.parse(fs.readFileSync(nsPath, "utf-8"));
        } catch {
            return { ok: false, message: `invalid JSON: ${ns}.json` };
        }
        if (!isPlainResourceObject(parsed)) {
            return { ok: false, message: `namespace root must be an object: ${ns}.json` };
        }
    }

    return layout;
};

/**
 * Loads namespace JSON from a validated pack directory into an overlay map.
 */
export const loadPackOverlay = (packDir: string, manifest: TranslationPackManifest): PackOverlayMap => {
    const overlay: PackOverlayMap = {};
    for (const ns of manifest.namespaces) {
        const parsed: unknown = JSON.parse(fs.readFileSync(path.join(packDir, `${ns}.json`), "utf-8"));
        if (!isPlainResourceObject(parsed)) {
            throw new Error(`invalid namespace object: ${ns}`);
        }
        overlay[ns] = parsed;
    }
    return overlay;
};

const manifestToSource = (manifest: TranslationPackManifest): LanguageSource => ({
    id: packSourceId(manifest.id),
    name: manifest.name,
    locale: manifest.locale,
    kind: "pack",
    packId: manifest.id,
    version: manifest.version,
});

/**
 * Lists installed pack sources under the packs root (skips invalid folders with a warn log).
 */
export const listInstalledPackSources = (): LanguageSource[] => {
    const root = getI18nPacksRoot();
    const sources: LanguageSource[] = [];
    for (const name of fs.readdirSync(root)) {
        if (!PACK_ID_PATTERN.test(name)) continue;
        const packDir = path.join(root, name);
        if (!fs.statSync(packDir).isDirectory()) continue;
        const validated = validatePackDirectory(packDir, name);
        if (!validated.ok) {
            logger.warn("skipping invalid translation pack", { packId: name, reason: validated.message });
            continue;
        }
        sources.push(manifestToSource(validated.manifest));
    }
    return sources;
};

/**
 * Builtins plus installed packs for the language dropdown.
 */
export const listLanguageSources = (): LanguageSource[] => [...BUILTIN_SOURCES, ...listInstalledPackSources()];

/**
 * Loads overlay for a pack id, or null if the pack is missing/invalid.
 */
export const loadOverlayForPackId = (packId: string): PackOverlayMap | null => {
    if (!PACK_ID_PATTERN.test(packId)) {
        logger.warn("rejected pack id outside allowlist", { packId });
        return null;
    }
    const packDir = path.join(getI18nPacksRoot(), packId);
    if (!fs.existsSync(packDir)) return null;
    const validated = validatePackDirectory(packDir, packId);
    if (!validated.ok) {
        logger.warn("failed to load pack overlay", { packId, reason: validated.message });
        return null;
    }
    return loadPackOverlay(packDir, validated.manifest);
};

const assertPathInside = (root: string, candidate: string): void => {
    const resolvedRoot = path.resolve(root);
    const resolved = path.resolve(candidate);
    const rel = path.relative(resolvedRoot, resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
        throw new Error("path escapes pack root");
    }
};

/**
 * Walks an extracted archive tree and rejects symlink / path-escape entries
 * before any files are copied into `{userData}/i18n-packs`.
 */
const assertExtractedTreeSafe = (root: string): void => {
    const walk = (dir: string): void => {
        for (const name of fs.readdirSync(dir)) {
            const full = path.join(dir, name);
            assertPathInside(root, full);
            const st = fs.lstatSync(full);
            if (st.isSymbolicLink()) {
                throw new Error(`symlink not allowed in pack archive: ${name}`);
            }
            if (st.isDirectory()) walk(full);
        }
    };
    walk(root);
};

/**
 * Installs a `.zip` pack archive into `{userData}/i18n-packs/<id>/`.
 *
 * @throws Error when archive validation or extract fails in unexpected ways; returns `{ ok: false }` for user errors
 */
export const installPackFromArchive = async (
    archivePath: string,
): Promise<{ ok: true; source: LanguageSource } | { ok: false; message: string }> => {
    if (!fs.existsSync(archivePath) || !fs.statSync(archivePath).isFile()) {
        return { ok: false, message: "archive not found" };
    }
    if (fs.statSync(archivePath).size > PACK_ARCHIVE_MAX_BYTES) {
        return { ok: false, message: "archive too large" };
    }

    const tempRoot = path.join(app.getPath("temp"), `yomikiru-i18n-pack-${Date.now()}`);
    fs.mkdirSync(tempRoot, { recursive: true });
    try {
        await unzip(archivePath, tempRoot);
        try {
            assertExtractedTreeSafe(tempRoot);
        } catch (err) {
            logger.warn("rejected unsafe pack archive extract", { archivePath }, err);
            return { ok: false, message: "archive contains unsafe paths" };
        }

        /* zip may contain a single top-level folder or files at root */
        const top = listPackRoot(tempRoot);
        let packDir = tempRoot;
        if (top.files.length === 0 && top.directories.length === 1) {
            packDir = path.join(tempRoot, top.directories[0]);
        }

        const validated = validatePackDirectory(packDir);
        if (!validated.ok) return validated;

        const dest = path.join(getI18nPacksRoot(), validated.manifest.id);
        if (fs.existsSync(dest)) {
            fs.rmSync(dest, { recursive: true, force: true });
        }
        fs.mkdirSync(dest, { recursive: true });

        for (const file of listPackRoot(packDir).files) {
            const from = path.join(packDir, file);
            const to = path.join(dest, file);
            assertPathInside(dest, to);
            fs.copyFileSync(from, to);
        }

        logger.info("installed translation pack", {
            packId: validated.manifest.id,
            locale: validated.manifest.locale,
        });
        return { ok: true, source: manifestToSource(validated.manifest) };
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
};

/**
 * Deletes an installed pack directory.
 */
export const removeInstalledPack = (packId: string): { ok: true } | { ok: false; message: string } => {
    if (!PACK_ID_PATTERN.test(packId)) {
        return { ok: false, message: "invalid pack id" };
    }
    const dest = path.join(getI18nPacksRoot(), packId);
    if (!fs.existsSync(dest)) {
        return { ok: false, message: "pack not found" };
    }
    fs.rmSync(dest, { recursive: true, force: true });
    logger.info("removed translation pack", { packId });
    return { ok: true };
};

/**
 * Zips an installed pack (or a temporary builtin English export) to `destinationPath`.
 */
export const exportPackToArchive = async (
    packDir: string,
    destinationPath: string,
): Promise<{ ok: true } | { ok: false; message: string }> => {
    const validated = validatePackDirectory(packDir);
    if (!validated.ok) return validated;
    try {
        await zip(packDir, destinationPath);
        return { ok: true };
    } catch (err) {
        logger.error("export pack zip failed", { destinationPath }, err);
        return { ok: false, message: "zip failed" };
    }
};

/**
 * Writes a temporary folder for exporting any builtin locale as a shareable pack zip.
 */
export const materializeBuiltinExportDir = (args: {
    locale: string;
    name: string;
    resources: PackOverlayMap;
}): string => {
    const { locale, name, resources } = args;
    const tempDir = path.join(app.getPath("temp"), `yomikiru-i18n-builtin-${locale}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    const namespaces = Object.keys(resources);
    const manifest: TranslationPackManifest = {
        id: `${locale}-builtin-export`,
        name: `${name} (built-in export)`,
        locale,
        version: app.getVersion(),
        namespaces: namespaces as TranslationPackManifest["namespaces"],
    };
    fs.writeFileSync(path.join(tempDir, "pack.json"), JSON.stringify(manifest, null, 2), "utf-8");
    for (const ns of namespaces) {
        fs.writeFileSync(path.join(tempDir, `${ns}.json`), JSON.stringify(resources[ns], null, 2), "utf-8");
    }
    return tempDir;
};
