module.exports = {
    packagerConfig: {
        name: "Yomikiru",
    },
    plugins: [{
        name: "@electron-forge/plugin-webpack",
        config: {
            mainConfig: "./webpack/main.webpack.js",
            "devContentSecurityPolicy": "connect-src 'self' * 'unsafe-eval'",
            renderer: {
                config: "./webpack/renderer.webpack.js",
                entryPoints: [{
                    html: "./public/index.html",
                    js: "./src/index.tsx",
                    name: "home",
                }],
            },
        },
    }, ],
    makers: [{
            name: "@electron-forge/maker-squirrel",
            config: {
                // name: "Yomikiru",
                // exe: "Yomikiru.exe",
                // setupExe: `${packageJSON.name}_${packageJSON.version}_windows-setup.exe`,
            },
        },
        {
            name: '@electron-forge/maker-deb',
            config: {
              options: {
                maintainer: 'mienaiyami',
                homepage: 'https://github.com/mienaiyami/yomikiru',
                bin:"./Yomikiru",
                depends:["unzip","xdg-utils"]
              }
            }
        }
        // {
        //     name: "@electron-forge/maker-zip",
        //     dir: `${packageJSON.name}_${packageJSON.version}_windows-portable`,
        // },
    ],
};