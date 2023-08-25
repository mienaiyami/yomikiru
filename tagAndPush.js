/* eslint-disable @typescript-eslint/no-var-requires */
// /* eslint-disable @typescript-eslint/no-var-requires */
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const { exec } = require("child_process");
const pkgJSON = require("./package.json");

const tagAndPush = () => {
    console.log(`Tagging v${pkgJSON.version} and pushing tags.`);
    const push = () => {
        const gitSpawn = exec(`git push --tags`);
        gitSpawn.stderr.on("data", (data) => {
            process.stdout.write(`\x1b[91m${data}\x1b[0m`);
        });
        gitSpawn.on("close", (code) => {
            console.log(`push tags: exited with code ${code}.`);
        });
    };
    const gitSpawn = exec(`git tag -a v${pkgJSON.version} -m"v${pkgJSON.version}"`);
    gitSpawn.stderr.on("data", (data) => {
        process.stdout.write(`\x1b[91m${data}\x1b[0m`);
    });
    gitSpawn.on("close", (code) => {
        console.log(`git tag: exited with code ${code}.`);
        push();
    });
};

rl.question(
    "\x1b[91mMake sure to edit and commit package.json with version change and changelog.md before starting.\x1b[0m",
    (e) => {
        if (e === "") tagAndPush();
        rl.close();
    }
);
