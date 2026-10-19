import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ForgeMakeResult } from "@electron-forge/shared-types";
import packageJSON from "../package.json";

const BUILD_ARTIFACTS_DIR = path.resolve("./build-artifacts");
const MAIN_OUT_DIR = path.resolve("./out/all");
const DOWNLOAD_BTNS_TXT = "download-btns.txt";
const ARTIFACTS_JSON = "artifacts.json";
const CHECKSUMS_TXT = "checksums.txt";

type DownloadButtonParams = {
    text?: string;
    name: string;
    icon?: string;
    url: string;
    version: string;
};

type ArtifactMetadata = {
    name: string;
    sha256: string;
    size: number;
    description: string;
    platform: string;
    arch: string;
    type: string;
    /** When false, the file is still uploaded and listed in artifacts.json, but not in the release-notes table. */
    listInReleaseNotes?: boolean;
};

const {
    productName: appName,
    version: appVersion,
    author: { url: baseUrl },
} = packageJSON;

/** Filenames the 32-bit updater still requests. Each file is a copy of the matching 64-bit build. */
const LEGACY_WIN32_PORTABLE_NAME = `${appName}-win32-v${appVersion}-Portable.zip`;
const LEGACY_WIN32_SETUP_NAME = `${appName}-v${appVersion}-Setup.exe`;

/**
 * Creates artifact mapping for different platform/arch combinations
 */
const createArtifactMap = (appNameParam: string, appVersionParam: string) => ({
    "win32+zip+x64": {
        name: `${appNameParam}-win32-v${appVersionParam}-Portable-x64.zip`,
        text: "64-bit Portable (windows zip)",
        icon: "windows&logoColor=blue",
    },
    "win32+exe+x64": {
        name: `${appNameParam}-v${appVersionParam}-Setup-x64.exe`,
        text: "64-bit Setup (windows exe)",
        icon: "windows&logoColor=blue",
    },
    "linux+deb+x64": {
        name: `${appNameParam}-v${appVersionParam}-amd64.deb`,
        text: "64-bit Linux (Debian)",
        icon: "debian&logoColor=red",
    },
    "linux+deb+amd64": {
        name: `${appNameParam}-v${appVersionParam}-amd64.deb`,
        text: "64-bit Linux (Debian)",
        icon: "debian&logoColor=red",
    },
    "linux+pkg.tar.zst+x64": {
        name: `${appNameParam.toLowerCase()}-${appVersionParam.replace(/-/g, "_")}-x86_64.pkg.tar.zst`,
        text: "64-bit Linux (Arch)",
        icon: "archlinux&logoColor=blue",
    },
    "darwin+zip+x64": {
        name: `${appNameParam}-v${appVersionParam}-macOS-x64.zip`,
        text: "64-bit macOS (zip)",
        icon: "apple&logoColor=black",
    },
});

type ArtifactKey = keyof ReturnType<typeof createArtifactMap>;

/**
 * Calculates SHA256 hash of a file
 */
const calculateSHA256 = (filePath: string): string => {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = createHash("sha256");
    hashSum.update(new Uint8Array(fileBuffer));
    return hashSum.digest("hex");
};

/**
 * Gets file size in bytes
 */
const getFileSize = (filePath: string): number => {
    const stats = fs.statSync(filePath);
    return stats.size;
};

const getArtifactType = (ext: string): string => {
    return ext === "exe"
        ? "installer"
        : ext === "zip"
          ? "portable"
          : ext === "deb"
            ? "package"
            : ext === "zst"
              ? "package"
              : ext;
};

/**
 * Creates a markdown download badge button
 */
const makeDownloadButton = ({ text, name, icon, url, version }: DownloadButtonParams): string => {
    const encodedText = encodeURIComponent(text ?? "").replace(/-/g, "--");
    const encodedName = encodeURIComponent(name).replace(/-/g, "--");
    const badgeUrl = `https://img.shields.io/badge/${encodedText}-${encodedName}-brightgreen?logo=${icon}`;
    const downloadUrl = `${url}/releases/download/v${version}/${name}`;
    return `[![${text}](${badgeUrl})](${downloadUrl})`;
};

const makeDownloadLink = ({ name, url, version }: DownloadButtonParams): string => {
    return `[${name}](${url}/releases/download/v${version}/${name})`;
};

/*
 * TODO: remove publishLegacyWindowsAliases and the 32-bit paragraph in the Downloads
 * section once most installs are on the 64-bit build. The copies exist only so an old
 * 32-bit updater still resolves a file.
 */
/**
 * Copies each 64-bit Windows build onto the filename a 32-bit updater still requests.
 * The copies are release assets and artifacts.json rows. They are omitted from the release-notes table.
 */
const publishLegacyWindowsAliases = (artifacts: ArtifactMetadata[], checksums: string[]): void => {
    const aliases = [
        { type: "portable", legacyName: LEGACY_WIN32_PORTABLE_NAME },
        { type: "installer", legacyName: LEGACY_WIN32_SETUP_NAME },
    ] as const;
    for (const alias of aliases) {
        const source = artifacts.find(
            (artifact) => artifact.platform === "win32" && artifact.arch === "x64" && artifact.type === alias.type,
        );
        if (!source) continue;
        const sourcePath = path.join(MAIN_OUT_DIR, source.name);
        if (!fs.existsSync(sourcePath)) {
            console.warn(`Legacy Windows alias skipped; missing ${source.name}`);
            continue;
        }
        const destPath = path.join(MAIN_OUT_DIR, alias.legacyName);
        fs.copyFileSync(sourcePath, destPath);
        const sha256 = calculateSHA256(destPath);
        artifacts.push({
            name: alias.legacyName,
            sha256,
            size: getFileSize(destPath),
            description: `${source.description} (legacy 32-bit filename; file is the 64-bit build)`,
            platform: "win32",
            arch: "ia32",
            type: alias.type,
            listInReleaseNotes: false,
        });
        checksums.push(`${sha256}  ${alias.legacyName}`);
    }
};

/**
 * Main function to generate release artifacts
 */
const generateRelease = () => {
    if (!fs.existsSync(BUILD_ARTIFACTS_DIR)) {
        console.error(`Build artifacts directory not found: ${BUILD_ARTIFACTS_DIR}`);
        process.exit(1);
    }

    if (!fs.existsSync(MAIN_OUT_DIR)) {
        fs.mkdirSync(MAIN_OUT_DIR, { recursive: true });
    }

    const artifactMap = createArtifactMap(appName, appVersion);
    const artifacts: ArtifactMetadata[] = [];
    const checksums: string[] = [];

    // Read all makeResults JSON files
    const jsonFiles = fs
        .readdirSync(BUILD_ARTIFACTS_DIR)
        .filter((f) => f.endsWith(".json"))
        .map((f) => path.join(BUILD_ARTIFACTS_DIR, f));

    if (jsonFiles.length === 0) {
        console.error("No build artifact JSON files found");
        process.exit(1);
    }

    const allMakeResults: ForgeMakeResult[] = [];
    for (const jsonFile of jsonFiles) {
        try {
            const content = fs.readFileSync(jsonFile, "utf-8");
            const makeResults = JSON.parse(content) as ForgeMakeResult[];
            allMakeResults.push(...makeResults);
        } catch (error) {
            console.warn(`Failed to parse ${jsonFile}: ${error}`);
        }
    }

    // normalize path - convert relative paths to absolute, handle cross-platform
    const resolveArtifactPath = (artifactPath: string): string => {
        if (path.isAbsolute(artifactPath)) {
            return artifactPath;
        }
        return path.resolve(process.cwd(), artifactPath);
    };

    // normalize arch for Linux (amd64/x86_64 -> x64); Windows arch is already x64 or arm64
    const normalizeArchForLinux = (arch: string): string => {
        if (arch === "amd64" || arch === "x86_64") return "x64";
        return arch;
    };

    for (const res of allMakeResults) {
        for (const artifactPath of res.artifacts) {
            const resolvedPath = resolveArtifactPath(artifactPath);
            const filename = path.basename(resolvedPath);
            const ext = path.extname(resolvedPath).replace(".", "");

            if (filename === "RELEASES" || filename.endsWith(".nupkg")) {
                continue;
            }

            let artifactKey: ArtifactKey | null = null;

            if (res.platform === "win32") {
                // Windows arch is already the make target (x64 or arm64)
                const winArch = res.arch;
                if (ext === "exe") {
                    artifactKey = `win32+exe+${winArch}` as ArtifactKey;
                } else if (ext === "zip") {
                    artifactKey = `win32+zip+${winArch}` as ArtifactKey;
                }
            } else if (res.platform === "linux") {
                const normalizedArch = normalizeArchForLinux(res.arch);
                if (ext === "deb") {
                    const debArch = res.arch === "amd64" ? "amd64" : normalizedArch;
                    artifactKey = `linux+deb+${debArch}` as ArtifactKey;
                    if (!(artifactKey in artifactMap)) {
                        artifactKey = `linux+deb+x64` as ArtifactKey;
                    }
                } else if (filename.endsWith(".pkg.tar.zst")) {
                    artifactKey = "linux+pkg.tar.zst+x64" as ArtifactKey;
                }
            } else if (res.platform === "darwin") {
                const normalizedArch = normalizeArchForLinux(res.arch);
                if (ext === "zip") {
                    artifactKey = `darwin+zip+${normalizedArch}` as ArtifactKey;
                }
            }

            if (!artifactKey || !(artifactKey in artifactMap)) {
                console.warn(`Unknown artifact: ${filename} (${res.platform}/${res.arch}/${ext})`);
                continue;
            }

            const artifactInfo = artifactMap[artifactKey];
            const newPath = path.join(MAIN_OUT_DIR, artifactInfo.name);

            // Check if file exists at original path or renamed path
            let finalPath: string | null = null;
            if (fs.existsSync(resolvedPath)) {
                finalPath = resolvedPath;
            } else if (fs.existsSync(newPath)) {
                // File already renamed in a previous run
                finalPath = newPath;
            } else {
                console.warn(`Artifact not found at ${resolvedPath} or ${newPath}, skipping`);
                continue;
            }

            // Rename file to expected name if needed
            if (finalPath !== newPath) {
                if (fs.existsSync(newPath)) {
                    console.warn(`File already exists at ${newPath}, skipping rename`);
                    finalPath = newPath;
                } else {
                    fs.renameSync(finalPath, newPath);
                    finalPath = newPath;
                }
            }
            const sha256 = calculateSHA256(finalPath);
            const size = getFileSize(finalPath);
            const [platform] = artifactKey.split("+");
            const type = getArtifactType(ext);

            // Determine final arch for metadata
            let finalArch = res.arch;
            if (artifactKey === "linux+pkg.tar.zst+x64") {
                finalArch = "x86_64";
            } else if (res.platform === "win32") {
                // Windows arch stays as the make target reported it
                finalArch = res.arch;
            } else if (res.platform === "linux" && res.arch === "amd64") {
                finalArch = "amd64";
            } else if (res.platform === "linux") {
                // For other Linux arches, use normalized version
                finalArch = normalizeArchForLinux(res.arch);
            }

            artifacts.push({
                name: artifactInfo.name,
                sha256,
                size,
                description: artifactInfo.text,
                platform,
                arch: finalArch,
                type,
            });

            checksums.push(`${sha256}  ${artifactInfo.name}`);
        }
    }

    publishLegacyWindowsAliases(artifacts, checksums);

    // const downloadButtons: string[] = [];
    // for (const artifact of artifacts) {
    //     const artifactInfo = Object.values(artifactMap).find((info) => info.name === artifact.name);
    //     if (artifactInfo) {
    //         const button = makeDownloadButton({
    //             text: artifactInfo.text,
    //             name: artifact.name,
    //             icon: artifactInfo.icon,
    //             url: baseUrl,
    //             version: appVersion,
    //         });
    //         downloadButtons.push(button);
    //     }
    // }
    // const downloadSection = `## Downloads\n\n${downloadButtons.join(" ")}\n`;
    const downloadSection = `## Downloads

32-bit Windows builds are no longer produced. The Windows files in the table below are 64-bit (portable zip and setup). Windows 7, 8, and 8.1 are not supported. Details: https://github.com/mienaiyami/yomikiru/discussions/556

The last stable release that still supports those systems and 32-bit Windows is **2.24.0**. The last beta is **2.25.0-beta.7**.

A 32-bit install that checks for updates will download a file that still uses the old 32-bit filename. That file is the 64-bit app, so the update only runs on 64-bit Windows. A 32-bit PC should stay on 2.24.0 (stable) or 2.25.0-beta.7 (beta).

`;
    fs.writeFileSync(DOWNLOAD_BTNS_TXT, downloadSection, "utf-8");

    const sortedArtifacts = [...artifacts].sort((a, b) => {
        const platformOrder: Record<string, number> = {
            win32: 0,
            darwin: 1,
            linux: 2,
        };
        const aPlatformOrder = platformOrder[a.platform] ?? 999;
        const bPlatformOrder = platformOrder[b.platform] ?? 999;

        if (aPlatformOrder !== bPlatformOrder) {
            return aPlatformOrder - bPlatformOrder;
        }

        if (a.arch !== b.arch) return a.arch.localeCompare(b.arch);

        return a.type.localeCompare(b.type);
    });

    const catalogArtifacts = sortedArtifacts.map((artifact) => {
        const { listInReleaseNotes, ...catalogRow } = artifact;
        void listInReleaseNotes;
        return catalogRow;
    });
    fs.writeFileSync(ARTIFACTS_JSON, JSON.stringify(catalogArtifacts, null, 2), "utf-8");

    const sortedChecksums = [...checksums].sort();
    const checksumsContent = `${sortedChecksums.join("\n")}\n`;
    fs.writeFileSync(CHECKSUMS_TXT, checksumsContent, "utf-8");

    // Generate artifacts table and append to download buttons file
    const tableRows: string[] = [];
    tableRows.push("| Description | File | SHA256 Hash |");
    tableRows.push("|-------------|------|-------------|");

    for (const artifact of sortedArtifacts) {
        if (artifact.listInReleaseNotes === false) continue;
        // const artifactInfo = Object.values(artifactMap).find((info) => info.name === artifact.name);
        // const badge = artifactInfo
        //     ? makeDownloadButton({
        //           text: artifactInfo.text,
        //           name: artifact.name,
        //           icon: artifactInfo.icon,
        //           url: baseUrl,
        //           version: appVersion,
        //       })
        //     : artifact.name;
        const hashFull = artifact.sha256;
        const hashCell = `<code>${hashFull}</code>`;
        const downloadLink = makeDownloadLink({ name: artifact.name, url: baseUrl, version: appVersion });
        tableRows.push(`| ${artifact.description} | ${downloadLink} | ${hashCell} |`);
    }

    const tableContent = `${tableRows.join("\n")}\n`;
    fs.appendFileSync(DOWNLOAD_BTNS_TXT, tableContent, "utf-8");

    console.log(`Generated release artifacts:`);
    console.log(`- ${sortedArtifacts.length} artifacts processed`);
    console.log(`- Download buttons: ${DOWNLOAD_BTNS_TXT}`);
    console.log(`- Artifacts JSON: ${ARTIFACTS_JSON}`);
    console.log(`- Checksums: ${CHECKSUMS_TXT}`);
};

generateRelease();
