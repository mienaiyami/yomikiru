import fs from "node:fs";
import path from "node:path";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";
import type { ForgeConfig, ForgeMakeResult } from "@electron-forge/shared-types";
import packageJSON from "./package.json";
import { mainConfig } from "./webpack/webpack.main.config";
import { preloadConfig } from "./webpack/webpack.preload.config";
import { rendererConfig } from "./webpack/webpack.renderer.config";

// ! its not possible to build all targets arch at once for windows anymore, because of `better-sqlite3` rebuild

const MAIN_OUT_DIR = path.resolve("./out/all");

/** Dependency directory that contains the precompiled 7-Zip runtimes. */
const ARCHIVE_BINARY_PACKAGE_DIRECTORY = path.resolve("./node_modules/7zip-bin-full");

/** Root dependency directory used to assemble external native runtimes. */
const NODE_MODULES_DIRECTORY = path.resolve("./node_modules");

/** Packaged resource directory resolved by the main-process archive module. */
const ARCHIVE_BINARY_RESOURCE_DIRECTORY = "7zip";

/** Packaged resource directory resolved by the main-process cover module. */
const SHARP_RUNTIME_RESOURCE_DIRECTORY = "sharp";

/** Runtime files required by each packaged operating system. */
const ARCHIVE_RUNTIME_FILES: Record<string, readonly string[]> = {
    darwin: ["7zz", "License.txt"],
    linux: ["7zz", "License.txt"],
    win32: ["7z.exe", "7z.dll", "License.txt"],
};

const { productName: appName } = packageJSON;

type PackagerHook = NonNullable<NonNullable<ForgeConfig["packagerConfig"]>["afterCopyExtraResources"]>[number];

/** Maps Electron's platform name to the directory published by `7zip-bin-full`. */
const archivePackagePlatform = (platform: string): string => {
    if (platform === "win32") return "win";
    if (platform === "darwin") return "mac";
    if (platform === "linux") return "linux";
    throw new Error(`7-Zip does not provide a runtime for ${platform}`);
};

/** Maps package targets to the architecture names used by the archive dependency. */
const archivePackageArchitectures = (arch: string): string[] => {
    if (arch === "universal") return ["x64", "arm64"];
    return [arch === "armv7l" ? "arm" : arch];
};

/** Resolves Electron's resources directory inside the packager staging tree. */
const packagedResourcesDirectory = (buildPath: string, platform: string): string => {
    if (platform !== "darwin") return path.join(buildPath, "resources");
    const appBundle = fs.readdirSync(buildPath).find((entry) => entry.endsWith(".app"));
    if (!appBundle) throw new Error("Packaged macOS application bundle was not found");
    return path.join(buildPath, appBundle, "Contents", "Resources");
};

/** Resolves an installed package directory without evaluating its runtime entry point. */
const runtimePackageDirectory = (packageName: string): string =>
    path.join(NODE_MODULES_DIRECTORY, ...packageName.split("/"));

/** Copies one external runtime package while dereferencing pnpm's dependency links. */
const copyRuntimePackage = (packageName: string, destinationNodeModules: string): void => {
    const source = runtimePackageDirectory(packageName);
    if (!fs.existsSync(source)) {
        throw new Error(`Required package runtime is not installed for this target: ${packageName}`);
    }
    fs.cpSync(source, path.join(destinationNodeModules, ...packageName.split("/")), {
        recursive: true,
        dereference: true,
    });
};

/** Reads Sharp's ordinary runtime dependencies so packaging follows dependency upgrades. */
const sharpRuntimeDependencies = (): string[] => {
    const manifestPath = path.join(runtimePackageDirectory("sharp"), "package.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        dependencies?: Record<string, string>;
    };
    return ["sharp", ...Object.keys(manifest.dependencies ?? {})];
};

/** Copies Sharp and only the native packages needed by the Forge package target. */
const copySharpRuntime = (resourcesDirectory: string, platform: string, architectures: string[]): void => {
    const destinationNodeModules = path.join(resourcesDirectory, SHARP_RUNTIME_RESOURCE_DIRECTORY, "node_modules");
    for (const packageName of sharpRuntimeDependencies()) {
        copyRuntimePackage(packageName, destinationNodeModules);
    }

    for (const packageArch of architectures) {
        const runtimePlatform = `${platform}-${packageArch}`;
        copyRuntimePackage(`@img/sharp-${runtimePlatform}`, destinationNodeModules);
        if (platform !== "win32") {
            copyRuntimePackage(`@img/sharp-libvips-${runtimePlatform}`, destinationNodeModules);
        }
    }
};

/** Copies 7-Zip and Sharp runtimes selected for each Forge package target. */
const copyPackagedRuntimes: PackagerHook = (buildPath, _electronVersion, platform, arch, callback) => {
    try {
        const packagePlatform = archivePackagePlatform(platform);
        const runtimeFiles = ARCHIVE_RUNTIME_FILES[platform];
        if (!runtimeFiles) throw new Error(`7-Zip runtime files are not defined for ${platform}`);

        const resourcesDirectory = packagedResourcesDirectory(buildPath, platform);
        const packageArchitectures = archivePackageArchitectures(arch);
        for (const packageArch of packageArchitectures) {
            const sourceDirectory = path.join(ARCHIVE_BINARY_PACKAGE_DIRECTORY, packagePlatform, packageArch);
            const destinationDirectory = path.join(
                resourcesDirectory,
                ARCHIVE_BINARY_RESOURCE_DIRECTORY,
                packageArch,
            );
            fs.mkdirSync(destinationDirectory, { recursive: true });

            for (const filename of runtimeFiles) {
                const destination = path.join(destinationDirectory, filename);
                fs.copyFileSync(path.join(sourceDirectory, filename), destination);
                if (filename === "7zz") fs.chmodSync(destination, 0o755);
            }
        }
        copySharpRuntime(resourcesDirectory, platform, packageArchitectures);
        callback();
    } catch (error) {
        callback(error instanceof Error ? error : new Error(String(error)));
    }
};

const config: ForgeConfig = {
    packagerConfig: {
        name: appName,
        asar: true,
        /*
         * 7-Zip must live outside ASAR because Electron cannot execute bundled binaries.
         * The packaging hook copies only the current target's executable and companion files.
         */
        extraResource: ["./drizzle", "./public/app.ico"],
        afterCopyExtraResources: [copyPackagedRuntimes],
        executableName: process.platform === "win32" ? appName : appName.toLowerCase(),
    },
    plugins: [
        new AutoUnpackNativesPlugin({}),
        new WebpackPlugin({
            devServer: {
                liveReload: false,
            },
            mainConfig,
            renderer: {
                config: rendererConfig,
                entryPoints: [
                    {
                        html: "./public/index.html",
                        js: "./src/renderer/index.tsx",
                        name: "home",
                        preload: {
                            js: "./src/electron/preload.ts",
                            config: preloadConfig,
                        },
                    },
                    {
                        html: "./public/download-progress.html",
                        js: "./public/download-progress.js",
                        name: "download_progress",
                    },
                ],
            },
            devContentSecurityPolicy: "connect-src 'self' * 'unsafe-eval'",
        }),
    ],
    makers: [
        new MakerSquirrel({}, ["win32"]),
        new MakerZIP({}, ["win32", "darwin", "linux"]),
        new MakerDeb(
            {
                options: {
                    maintainer: "mienaiyami",
                    homepage: "https://github.com/mienaiyami/yomikiru",
                    bin: "./Yomikiru",
                    depends: ["xdg-utils"],
                },
            },
            ["linux"],
        ),
    ],
    hooks: {
        postMake: async (_config: unknown, makeResults: ForgeMakeResult[]) => {
            const BUILD_ARTIFACTS_DIR = path.resolve("./build-artifacts");

            if (!fs.existsSync(BUILD_ARTIFACTS_DIR)) {
                fs.mkdirSync(BUILD_ARTIFACTS_DIR, { recursive: true });
            }

            if (!fs.existsSync(MAIN_OUT_DIR)) {
                fs.mkdirSync(MAIN_OUT_DIR, { recursive: true });
            }

            const platform = makeResults[0].platform;
            const arch = makeResults[0].arch;
            const timestamp = Date.now();
            const filename = `${platform}-${arch}-${timestamp}.json`;
            const filePath = path.join(BUILD_ARTIFACTS_DIR, filename);

            // normalize paths to be relative to process.cwd() for cross-platform compatibility
            const normalizePath = (filePath: string): string => {
                const cwd = process.cwd();
                if (path.isAbsolute(filePath)) {
                    const relative = path.relative(cwd, filePath);
                    return relative.startsWith("..") ? filePath : relative;
                }
                return filePath;
            };

            const artifactsToSave = makeResults.map((result) => ({
                platform: result.platform,
                arch: result.arch,
                artifacts: result.artifacts.map(normalizePath),
            }));

            fs.writeFileSync(filePath, JSON.stringify(artifactsToSave, null, 2), "utf-8");
            console.log(`Saved build artifacts to: ${filePath}`);

            return makeResults;
        },
    },
};

export default config;
