import type { Configuration } from "webpack";
import TsconfigPathsPlugin from "tsconfig-paths-webpack-plugin";
import { rules } from "./webpack.rules";
import { plugins } from "./webpack.plugins";

export const mainConfig: Configuration = {
    resolve: {
        extensions: [".ts", ".js"],

        plugins: [new TsconfigPathsPlugin()],
    },
    entry: "./src/electron/main.ts",
    module: {
        rules,
    },
    plugins,
};
