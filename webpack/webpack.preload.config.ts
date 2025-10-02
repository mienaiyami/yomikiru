import type { Configuration } from "webpack";

// import TsconfigPathsPlugin from "tsconfig-paths-webpack-plugin";

import { plugins } from "./webpack.plugins";
import { rules } from "./webpack.rules";

export const preloadConfig: Configuration = {
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
        // plugins: [new TsconfigPathsPlugin()],
    },
    module: {
        rules,
    },
    externals: {
        electron: "commonjs2 electron",
    },
    target: "electron-main",
    // node: { __dirname: false },
    plugins,
};
