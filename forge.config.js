module.exports = {
    packagerConfig: {
        name: "Manga Reader",
    },
    plugins: [
        [
            "@electron-forge/plugin-webpack",
            {
                mainConfig: "./webpack/main.webpack.js",
                renderer: {
                    config: "./webpack/renderer.webpack.js",
                    entryPoints: [
                        {
                            html: "./public/index.html",
                            js: "./src/index.tsx",
                            name: "home",
                        },
                    ],
                },
            },
        ],
    ],
    makers: [
        {
            name: "@electron-forge/maker-squirrel",
            config: {
                // name: "mangareader",
                // exe: "Manga Reader.exe",
                setupExe: "Manga Reader Setup.exe",
            },
        },
        // {
        //     name: "@electron-forge/maker-zip",
        // },
    ],
};
