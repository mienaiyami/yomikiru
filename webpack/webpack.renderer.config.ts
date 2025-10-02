import TsconfigPathsPlugin from "tsconfig-paths-webpack-plugin";
import type { Configuration } from "webpack";
import { plugins } from "./webpack.plugins";
import { rules } from "./webpack.rules";

rules.push({
    test: /\.css$/,
    use: [{ loader: "style-loader" }, { loader: "css-loader" }],
});

export const rendererConfig: Configuration = {
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
        plugins: [new TsconfigPathsPlugin()],
        fallback: {
            url: false,
            fs: false,
            path: false,
            os: false,
        },
    },
    module: {
        rules,
    },
    externals: {
        electron: "commonjs2 electron",
    },
    // target: "electron-renderer",
    plugins,

    mode: "development",
    devtool: "inline-source-map",
    target: "web",
};
