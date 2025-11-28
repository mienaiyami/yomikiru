import { execSync } from "node:child_process";
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

const { productName: appName } = packageJSON;

const config: ForgeConfig = {
    packagerConfig: {
        name: appName,
        asar: true,
        // needed for migrating better-sqlite3
        extraResource: ["./drizzle"],
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
        new MakerZIP({}, ["win32", "darwin"]),
        new MakerDeb(
            {
                options: {
                    maintainer: "mienaiyami",
                    homepage: "https://github.com/mienaiyami/yomikiru",
                    bin: "./Yomikiru",
                    depends: ["unzip", "xdg-utils"],
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

            let pacmanArtifactPath: string | null = null;
            if (platform === "linux") {
                const appName = makeResults[0].packageJSON.productName;
                const appVersion = makeResults[0].packageJSON.version;
                const expectedPkgName = `${appName}-v${appVersion}-x86_64.pkg.tar.xz`;
                const pkgFile = path.join(MAIN_OUT_DIR, expectedPkgName);

                const debArtifact = makeResults[0].artifacts.find((a: string) => a.endsWith(".deb"));
                if (debArtifact && fs.existsSync(debArtifact) && !fs.existsSync(pkgFile)) {
                    try {
                        const tempDir = path.join(MAIN_OUT_DIR, `temp-pacman-${Date.now()}`);
                        fs.mkdirSync(tempDir, { recursive: true });

                        execSync(`dpkg-deb -x "${debArtifact}" "${tempDir}/extracted"`, { stdio: "inherit" });
                        execSync(`dpkg-deb -e "${debArtifact}" "${tempDir}/control"`, { stdio: "inherit" });

                        const pkgDir = path.join(tempDir, "pkg");
                        const extractedDir = path.join(tempDir, "extracted");
                        if (fs.existsSync(extractedDir)) {
                            fs.mkdirSync(pkgDir, { recursive: true });
                            const usrDir = path.join(pkgDir, "usr");
                            fs.cpSync(extractedDir, usrDir, { recursive: true });
                        }

                        const pkgInfoPath = path.join(pkgDir, ".PKGINFO");
                        const stats = fs.statSync(debArtifact);
                        const pkgInfo = `pkgname = ${appName.toLowerCase()}
pkgver = ${appVersion}
pkgdesc = ${packageJSON.description}
url = ${packageJSON.author.url}
packager = ${packageJSON.author.name}
arch = x86_64
size = ${stats.size}
license = ${packageJSON.license}
`;
                        fs.writeFileSync(pkgInfoPath, pkgInfo);

                        const mtreePath = path.join(pkgDir, ".MTREE");
                        fs.writeFileSync(mtreePath, "#mtree\n");

                        execSync(
                            `cd "${pkgDir}" && tar -cJf "${pkgFile}" .PKGINFO .MTREE usr 2>/dev/null || (tar -cf - .PKGINFO .MTREE usr | xz > "${pkgFile}")`,
                            { stdio: "inherit" },
                        );

                        console.log(`Created pacman package: ${pkgFile}`);
                        pacmanArtifactPath = normalizePath(pkgFile);

                        fs.rmSync(tempDir, { recursive: true, force: true });
                    } catch (error) {
                        console.warn(`Failed to create pacman package: ${error}`);
                    }
                } else if (fs.existsSync(pkgFile)) {
                    pacmanArtifactPath = normalizePath(pkgFile);
                }
            }

            if (pacmanArtifactPath) {
                artifactsToSave[0].artifacts.push(pacmanArtifactPath);
            }

            fs.writeFileSync(filePath, JSON.stringify(artifactsToSave, null, 2), "utf-8");
            console.log(`Saved build artifacts to: ${filePath}`);

            return makeResults;
        },
    },
};

export default config;
