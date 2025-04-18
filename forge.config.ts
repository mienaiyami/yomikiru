import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";

import { mainConfig } from "./webpack/webpack.main.config";
import { rendererConfig } from "./webpack/webpack.renderer.config";
import { preloadConfig } from "./webpack/webpack.preload.config";

import fs from "fs";
import path from "path";

// ! its not possible to build all targets at once anymore, because of `better-sqlite3` rebuild

const config: ForgeConfig = {
    packagerConfig: {
        name: "Yomikiru",
        asar: true,
        // needed for migrating better-sqlite3
        extraResource: ["./drizzle"],
        executableName: process.platform === "win32" ? "Yomikiru" : "yomikiru",
    },
    // rebuildConfig: {
    //     extraModules: ["better-sqlite3"],
    //     force: true,
    // },
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
        new MakerZIP({}, ["win32"]),
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
        postMake: async (config, makeResults) => {
            // const appName = config.packagerConfig.name;
            const appName = "Yomikiru";
            const appVersion = makeResults[0].packageJSON.version;

            const MAP = {
                "win32+zip+ia32": {
                    name: `${appName}-win32-v${appVersion}-Portable.zip`,
                    text: "Download 32-bit Portable (zip)",
                    icon: "windows&logoColor=blue",
                },
                "win32+zip+x64": {
                    name: `${appName}-win32-v${appVersion}-Portable-x64.zip`,
                    text: "Download 64-bit Portable (zip)",
                    icon: "windows&logoColor=blue",
                },
                "win32+exe+ia32": {
                    name: `${appName}-v${appVersion}-Setup.exe`,
                    text: "Download 32-bit Setup (exe)",
                    icon: "windows&logoColor=blue",
                },
                "win32+exe+x64": {
                    name: `${appName}-v${appVersion}-Setup-x64.exe`,
                    text: "Download 64-bit Setup (exe)",
                    icon: "windows&logoColor=blue",
                },
                "linux+deb+x64": {
                    name: `${appName}-v${appVersion}-amd64.deb`,
                    text: "Download 64-bit Linux (Debian)",
                    icon: "debian&logoColor=red",
                },
                "linux+deb+amd64": {
                    name: `${appName}-v${appVersion}-amd64.deb`,
                    text: "Download 64-bit Linux (Debian)",
                    icon: "debian&logoColor=red",
                },
            };

            const makeDlBtn = ({
                text,
                name,
                icon,
                url,
            }: {
                text: string;
                name: string;
                icon: string;
                url: string;
            }) =>
                `[![${text}](https://img.shields.io/badge/${encodeURIComponent(text).replace(
                    /-/g,
                    "--",
                )}-${encodeURIComponent(name).replace(/-/g, "--")}-brightgreen?logo=${icon})](${
                    url
                }/releases/download/v${appVersion}/${name})\n`;

            const mainOutDir = path.resolve("./out/all");

            // const filesToUploadTxt = "files-to-upload.txt";
            const downloadBtnsTxt = "download-btns.txt";
            const initialDownloadBtns =
                `## Downloads\n\n` +
                // linux is built in another job and downloaded here as artifact
                makeDlBtn({
                    ...MAP["linux+deb+amd64"],
                    url: `${makeResults[0].packageJSON.author.url}/releases/download/v${appVersion}`,
                }) +
                "\n";

            if (!fs.existsSync(downloadBtnsTxt)) fs.writeFileSync(downloadBtnsTxt, initialDownloadBtns, "utf-8");
            // if (!fs.existsSync(filesToUploadTxt))
            //     fs.writeFileSync(
            //         filesToUploadTxt,
            //         path.join(mainOutDir, MAP["linux+deb+amd64"].name.replace(/\\/g, "/")) + " ",
            //         "utf-8",
            //     );

            if (!fs.existsSync(mainOutDir)) fs.mkdirSync(mainOutDir);

            makeResults.forEach((res, idx) => {
                // on windows squirrel, there are 3 artifacts and 2nd is the executable
                const mainIdx = res.artifacts.length === 1 ? 0 : 1;
                const key =
                    `${res.platform}+${path.extname(res.artifacts[mainIdx]).replace(".", "")}+${res.arch}` as keyof typeof MAP;
                if (!MAP[key]) {
                    console.error(`Unknown artifact: ${key}`);
                    process.exit(1);
                }
                const { name, text, icon } = MAP[key];

                const newPath = path.join(mainOutDir, name);
                fs.renameSync(res.artifacts[mainIdx], newPath);

                makeResults[idx].artifacts[mainIdx] = newPath;

                // fs.appendFileSync(filesToUploadTxt, newPath.replace(/\\/g, "/") + " ", "utf-8");

                const downloadBtn = makeDlBtn({
                    text,
                    name,
                    icon,
                    url: res.packageJSON.author.url,
                });

                fs.appendFileSync(downloadBtnsTxt, downloadBtn, "utf-8");
            });

            return makeResults;
        },
    },
};

export default config;
