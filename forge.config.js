module.exports = {
    packagerConfig: {
        name: "Yomikiru",
    },
    plugins: [
        {
            name: "@electron-forge/plugin-webpack",
            config: {
                mainConfig: "./webpack/main.webpack.js",
                devContentSecurityPolicy: "connect-src 'self' * 'unsafe-eval'",
                renderer: {
                    config: "./webpack/renderer.webpack.js",
                    entryPoints: [
                        {
                            html: "./public/index.html",
                            js: "./src/index.tsx",
                            name: "home",
                        },
                        {
                            html: "./public/download-progress.html",
                            js: "./public/download-progress.js",
                            name: "download_progress",
                        },
                    ],
                },
            },
        },
    ],
    makers: [
        {
            name: "@electron-forge/maker-squirrel",
            platforms: ["win32"],
            // config: {
            // name: "Yomikiru",
            // exe: "Yomikiru.exe",
            // setupExe: `${packageJSON.name}_${packageJSON.version}_windows-setup.exe`,
            // },
        },
        {
            name: "@electron-forge/maker-deb",
            platforms: ["linux"],
            config: {
                options: {
                    maintainer: "mienaiyami",
                    homepage: "https://github.com/mienaiyami/yomikiru",
                    bin: "./Yomikiru",
                    depends: ["unzip", "xdg-utils"],
                },
            },
        },
        {
            name: "@electron-forge/maker-zip",
            platforms: ["win32"],
        },
    ],
};
