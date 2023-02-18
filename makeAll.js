/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const {
    exec
} = require("child_process")
const pkgJSON = require("./package.json")

// if (fs.existsSync("./out/full")) {
//     fs.rmSync("./out/full/", {
//         recursive: true
//     })
// }
// fs.mkdirSync("./out/full")
const printProcessing = (string) => {
    let times = 0
    return setInterval(() => {
        times++
        process.stdout.clearLine()
        process.stdout.cursorTo(0)
        process.stdout.write(string + "".padEnd(times % 4, "."))
    }, 500);
    // console.log(`\x1b[31m${string} \x1b[0m`)
}

const makeAndPushTag = () => {

    const a = printProcessing(`Tagging v${pkgJSON.version} and pushing tags`)
    const push = () => {
        const gitSpawn = exec(`git push --tags`);
        gitSpawn.stderr.on('data', (data) => {
            process.stdout.write(`\x1b[91m${data}\x1b[0m`)
        });
        gitSpawn.on('close', (code) => {
            clearInterval(a);
            console.log(`push tags: spawn yarn child process exited with code ${code}.`);
            pushRelease();
        })
    }
    const gitSpawn = exec(`git tag -a v${pkgJSON.version} -m"v${pkgJSON.version}"`);
    gitSpawn.stderr.on('data', (data) => {
        process.stdout.write(`\x1b[91m${data}\x1b[0m`)
    });
    gitSpawn.on('close', (code) => {
        console.log(`git tag: spawn yarn child process exited with code ${code}.`);
        push();
    })

}

const pushRelease = () => {
    let changelog = fs.readFileSync("./changelog.md", "utf8");
    changelog = changelog.replaceAll("$$TAG$$", pkgJSON.version)
        .replaceAll("$$EXE_NAME$$", `Yomikiru-${pkgJSON.version}-Setup.exe`)
        .replaceAll("$$EXE_NAME_1$$", `Yomikiru--${pkgJSON.version}--Setup.exe`)
        .replaceAll("$$ZIP_NAME$$", `Yomikiru-win32-${pkgJSON.version}-Portable.zip`)
        .replaceAll("$$ZIP_NAME_1$$", `Yomikiru--win32--${pkgJSON.version}--Portable.zip`)
    if (fs.existsSync("./changelogTemp.md"))
        fs.rmSync("./changelogTemp.md");
    fs.writeFileSync("./changelogTemp.md", changelog)
    const pushCommand = (`gh release create v${pkgJSON.version} -t v${pkgJSON.version} ` +
        `--discussion-category "General" ` +
        "--generate-notes " +
        " -F changelogTemp.md " +
        // `--notes ""` +
        // "-d " +
        `./out/full/Manga.Reader-${pkgJSON.version}-Setup.exe ./out/full/Manga.Reader-win32-${pkgJSON.version}-Portable.zip `+
        `./out/full/Yomikiru-${pkgJSON.version}-Setup.exe ./out/full/Yomikiru-win32-${pkgJSON.version}-Portable.zip `
        )
    const a = printProcessing("Pushing build to gh release ")
    const ghSpawn = exec(pushCommand);
    ghSpawn.stderr.on('data', (data) => {
        process.stdout.write(`\x1b[91m${data}\x1b[0m`)
    });
    ghSpawn.on('close', (code) => {
        clearInterval(a);
        fs.rmSync("./changelogTemp.md");
        console.log(`spawn yarn child process exited with code ${code}.`);
        if (code === 0) {
            console.log("\x1b[92mPushed release to github. https://github.com/mienaiyami/yomikiru/releases.\x1b[0m");

            const gitSpawn = exec("git push origin");
            gitSpawn.stderr.on('data', (data) => {
                process.stdout.write(`\x1b[91m${data}\x1b[0m`)
            });
            gitSpawn.stdout.on('data', (data) => {
                process.stdout.write(data);
            });
        }
    })
}
const makeExe = () => {
    fs.writeFileSync("./electron/IS_PORTABLE.ts", `
    const isPortable = false;
    export default isPortable;
    `)
    const a = printProcessing('making exe ')
    // console.log(`./out/make/squirrel.windows/ia32/Yomikiru-${pkgJSON.version} Setup.exe`)
    const yarnSpawn = exec("yarn makeExe")
    // yarnSpawn.stdout.on('data', (data) => {
    //     process.stdout.write(data)
    // });
    yarnSpawn.stderr.on('data', (data) => {
        process.stdout.write(`\x1b[91m${data}\x1b[0m`)
    });
    yarnSpawn.on('close', (code) => {
        clearInterval(a)
        console.log(`spawn yarn child process exited with code ${code}.`);
        if (fs.existsSync(`./out/make/squirrel.windows/ia32/Yomikiru-${pkgJSON.version} Setup.exe`)) {
            console.log("\x1b[92m.exe create successfully \x1b[0m")
            console.log("moving .exe ...")
            fs.copyFileSync(`./out/make/squirrel.windows/ia32/Yomikiru-${pkgJSON.version} Setup.exe`,`./out/full/Manga.Reader-${pkgJSON.version}-Setup.exe`)
            fs.rename(`./out/make/squirrel.windows/ia32/Yomikiru-${pkgJSON.version} Setup.exe`,
                `./out/full/Yomikiru-${pkgJSON.version}-Setup.exe`, (err) => {
                    if (err) return console.error(err)
                    console.log("\x1b[92mmoved successfully. \x1b[0m")
                    makeZip()
                })
        } else {
            console.log("\x1b[91m.exe not found\x1b[0m")
        }
    });

}
const makeZip = () => {
    fs.writeFileSync("./electron/IS_PORTABLE.ts", `
    const isPortable = true;
    export default isPortable;
    `)
    const a = printProcessing("making zip ")
    // console.log(`./out/make/zip/win32/ia32/Manga.Reader-win32-${pkgJSON.version}-Portable.zip`)
    const yarnSpawn = exec("yarn makeZip")
    // yarnSpawn.stdout.on('data', (data) => {
    //     process.stdout.write(data)
    // });
    yarnSpawn.stderr.on('data', (data) => {
        process.stdout.write(`\x1b[91m${data}\x1b[0m`)
    });
    yarnSpawn.on('close', (code) => {
        clearInterval(a)
        console.log(`spawn yarn child process exited with code ${code}.`);
        if (fs.existsSync(`./out/make/zip/win32/ia32/Yomikiru-win32-ia32-${pkgJSON.version}.zip`)) {
            console.log("\x1b[92m.zip create successfully\x1b[0m")
            console.log("moving .zip...")
            fs.copyFileSync(`./out/make/zip/win32/ia32/Yomikiru-win32-ia32-${pkgJSON.version}.zip`,`./out/full/Manga.Reader-win32-${pkgJSON.version}-Portable.zip`,)
            fs.rename(`./out/make/zip/win32/ia32/Yomikiru-win32-ia32-${pkgJSON.version}.zip`,
                `./out/full/Yomikiru-win32-${pkgJSON.version}-Portable.zip`, (err) => {
                    if (err) return console.error(err)
                    console.log("\x1b[92mmoved successfully.\x1b[0m")
                    fs.writeFileSync("./electron/IS_PORTABLE.ts", `
                    const isPortable = false;
                    export default isPortable;
                    `)
                    makeAndPushTag();
                    // pushRelease()
                })
        } else {
            console.log("\x1b[91m.zip not found\x1b[0m")
        }
    });

}

rl.question("\x1b[91mMake sure to edit and commit package.json and changelog.md before starting.\x1b[0m", () => {
    makeExe()
    // pushRelease()
    rl.close();
})