import { exec } from "node:child_process";
import readline from "node:readline";
import packageJSON from "../package.json";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const tagAndPush = (): void => {
    console.log(`Tagging v${packageJSON.version} and pushing tags.`);
    const push = (): void => {
        const gitSpawn = exec(`git push --tags`);
        gitSpawn.stderr?.on("data", (data) => {
            process.stdout.write(`\x1b[91m${data}\x1b[0m`);
        });
        gitSpawn.on("close", (code) => {
            console.log(`push tags: exited with code ${code}.`);
        });
    };
    const gitSpawn = exec(`git tag -a v${packageJSON.version} -m"v${packageJSON.version}"`);
    gitSpawn.stderr?.on("data", (data) => {
        process.stdout.write(`\x1b[91m${data}\x1b[0m`);
    });
    gitSpawn.on("close", (code) => {
        console.log(`git tag: exited with code ${code}.`);
        push();
    });
};

rl.question(
    "\x1b[91mMake sure to edit and commit package.json with version change and changelog.md before starting.\x1b[0m",
    (answer: string) => {
        if (answer === "") tagAndPush();
        rl.close();
    },
);
