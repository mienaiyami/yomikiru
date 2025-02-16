import type { Configuration } from "webpack";

import { rules } from "./webpack.rules";
import { plugins } from "./webpack.plugins";

rules.push({
    test: /\.css$/,
    use: [{ loader: "style-loader" }, { loader: "css-loader" }],
});

export const rendererConfig: Configuration = {
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
    },
    module: {
        rules,
    },
    externals: {
        electron: "commonjs2 electron",
        "better-sqlite3": "commonjs better-sqlite3",
        // "../public/pdf.min.js": "pdfjsLib",
        // "../public/pdf.worker.min.js": "pdfjsLibWorker",
    },
    target: "electron-renderer",
    plugins,
    // target: "web",
};
