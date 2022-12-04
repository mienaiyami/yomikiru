/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const {
    exec
} = require("child_process")
const pkgJSON = require("./package.json")

if (fs.existsSync("./out/full")) {
    fs.rmSync("./out/full/", {
        recursive: true
    })
}
fs.mkdirSync("./out/full")
const printRed = (string) => {
    console.log(`\x1b[31m${string}\x1b[0m`)
}
const makeExe = () => {
    fs.writeFileSync("./electron/IS_PORTABLE.ts", `
    const isPortable = false;
    export default isPortable;
    `)
    printRed('making .exe')
    // console.log(`./out/make/squirrel.windows/ia32/Manga Reader-${pkgJSON.version} Setup.exe`)
    const yarnSpawn = exec("yarn makeExe")
    // yarnSpawn.stdout.on('data', (data) => {
    //     process.stdout.write(data)
    // });
    yarnSpawn.stderr.on('data', (data) => {
        process.stdout.write(data)
    });
    yarnSpawn.on('close', (code) => {
        console.log(`spawn yarn child process exited with code ${code}.`);
        if (fs.existsSync(`./out/make/squirrel.windows/ia32/Manga Reader-${pkgJSON.version} Setup.exe`)) {
            printRed(".exe create successfully")
            printRed("moving .exe ...")
            fs.rename(`./out/make/squirrel.windows/ia32/Manga Reader-${pkgJSON.version} Setup.exe`,
                `./out/full/Manga.Reader-${pkgJSON.version}-Setup.exe`, (err) => {
                    if (err) return console.error(err)
                    printRed("moved successfully.")
                    makeZip()
                })
        } else {
            printRed(".exe not found")
        }
    });

}
const makeZip = () => {
    fs.writeFileSync("./electron/IS_PORTABLE.ts", `
    const isPortable = true;
    export default isPortable;
    `)
    printRed("making .zip")
    // console.log(`./out/make/zip/win32/ia32/Manga.Reader-win32-${pkgJSON.version}-Portable.zip`)
    const yarnSpawn = exec("yarn makeZip")
    // yarnSpawn.stdout.on('data', (data) => {
    //     process.stdout.write(data)
    // });
    yarnSpawn.stderr.on('data', (data) => {
        process.stdout.write(data)
    });
    yarnSpawn.on('close', (code) => {
        printRed(`spawn yarn child process exited with code ${code}.`);
        if (fs.existsSync(`./out/make/zip/win32/ia32/Manga Reader-win32-ia32-${pkgJSON.version}.zip`)) {
            printRed(".zip create successfully")
            printRed("moving .zip...")
            fs.rename(`./out/make/zip/win32/ia32/Manga Reader-win32-ia32-${pkgJSON.version}.zip`,
                `./out/full/Manga.Reader-win32-${pkgJSON.version}-Portable.zip`, (err) => {
                    if (err) return console.error(err)
                    printRed("moved successfully.")
                    fs.writeFileSync("./electron/IS_PORTABLE.ts", `
                    const isPortable = false;
                    export default isPortable;
                    `)
                })
        } else {
            printRed(".zip not found")
        }
    });

}
makeExe()