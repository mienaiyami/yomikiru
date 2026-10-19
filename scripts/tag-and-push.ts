import { exec, execSync } from "node:child_process";
import readline from "node:readline";
import packageJSON from "../package.json";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

/**
 * Runs unit tests (`pnpm test`). Tagging must not continue if this fails.
 *
 * @throws when the test process exits non-zero
 */
const runUnitTests = (): void => {
    execSync("pnpm test", { stdio: "inherit" });
};

/**
 * Creates an annotated version tag and pushes tags. Runs only after unit tests pass.
 */
const tagAndPush = (): void => {
    console.log("Running unit tests before tagging...");
    try {
        runUnitTests();
    } catch {
        console.error("Unit tests failed; not tagging or pushing.");
        process.exit(1);
    }

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
        if (code !== 0) {
            console.error("git tag failed; not pushing tags.");
            process.exit(code ?? 1);
        }
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
