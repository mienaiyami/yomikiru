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
};

const {
    productName: appName,
    version: appVersion,
    author: { url: baseUrl },
} = packageJSON;

/**
 * Creates artifact mapping for different platform/arch combinations
 */
const createArtifactMap = (appNameParam: string, appVersionParam: string) => ({
    "win32+zip+ia32": {
        name: `${appNameParam}-win32-v${appVersionParam}-Portable.zip`,
        text: "32-bit Portable (windows zip)",
        icon: "windows&logoColor=blue",
    },
    "win32+zip+x64": {
        name: `${appNameParam}-win32-v${appVersionParam}-Portable-x64.zip`,
        text: "64-bit Portable (windows zip)",
        icon: "windows&logoColor=blue",
    },
    "win32+exe+ia32": {
        name: `${appNameParam}-v${appVersionParam}-Setup.exe`,
        text: "32-bit Setup (windows exe)",
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
    "linux+pkg.tar.xz+x64": {
        name: `${appNameParam}-v${appVersionParam}-x86_64.pkg.tar.xz`,
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
            : ext === "pkg.tar.xz"
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

    // normalize arch for Linux (amd64/x86_64 -> x64), Windows uses ia32/x64 directly
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
                // Windows uses arch as-is: ia32 or x64
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
                } else if (filename.endsWith(".pkg.tar.xz")) {
                    artifactKey = "linux+pkg.tar.xz+x64" as ArtifactKey;
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
            const type = getArtifactType(ext === "pkg.tar.xz" ? "pkg.tar.xz" : ext);

            // Determine final arch for metadata
            let finalArch = res.arch;
            if (artifactKey === "linux+pkg.tar.xz+x64") {
                finalArch = "x86_64";
            } else if (res.platform === "win32") {
                // Windows arch stays as-is (ia32 or x64)
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
    const downloadSection = `## Downloads\n`;
    fs.writeFileSync(DOWNLOAD_BTNS_TXT, downloadSection, "utf-8");

    const sortedArtifacts = [...artifacts].sort((a, b) => {
        if (a.platform !== b.platform) return a.platform.localeCompare(b.platform);
        if (a.arch !== b.arch) return a.arch.localeCompare(b.arch);
        return a.type.localeCompare(b.type);
    });

    fs.writeFileSync(ARTIFACTS_JSON, JSON.stringify(sortedArtifacts, null, 2), "utf-8");

    const sortedChecksums = [...checksums].sort();
    const checksumsContent = `${sortedChecksums.join("\n")}\n`;
    fs.writeFileSync(CHECKSUMS_TXT, checksumsContent, "utf-8");

    // Generate artifacts table and append to download buttons file
    const tableRows: string[] = [];
    tableRows.push("\n## Artifacts\n");
    tableRows.push("| File | SHA256 Hash | Description |");
    tableRows.push("|------|-------------|-------------|");

    for (const artifact of sortedArtifacts) {
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
        const fileName = `\`${artifact.name}\``;
        const downloadLink = makeDownloadLink({ name: artifact.name, url: baseUrl, version: appVersion });
        tableRows.push(`| ${downloadLink} | ${hashCell} | ${artifact.description} |`);
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
