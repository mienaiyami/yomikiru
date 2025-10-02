import TsconfigPathsPlugin from "tsconfig-paths-webpack-plugin";
import type { Configuration } from "webpack";
import { plugins } from "./webpack.plugins";
import { rules } from "./webpack.rules";

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
