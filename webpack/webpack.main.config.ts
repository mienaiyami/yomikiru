import TsconfigPathsPlugin from "tsconfig-paths-webpack-plugin";
import type { Compilation, Compiler, Configuration } from "webpack";
import { plugins } from "./webpack.plugins";
import { rules } from "./webpack.rules";

/** Directory where the asset relocator emits native dependencies beside the main bundle. */
const NATIVE_ASSET_DIRECTORY = "native_modules";

const assetRelocatorLoader = require("@vercel/webpack-asset-relocator-loader") as {
    initAssetCache: (compilation: Compilation, outputAssetBase: string) => void;
};

/** Ensures native asset paths are initialized in clean and incremental main-process builds. */
const nativeAssetRuntimePlugin = {
    apply: (compiler: Compiler): void => {
        compiler.hooks.compilation.tap("yomikiru-native-asset-runtime", (compilation) => {
            assetRelocatorLoader.initAssetCache(compilation, NATIVE_ASSET_DIRECTORY);
        });
    },
};

export const mainConfig: Configuration = {
    resolve: {
        extensions: [".ts", ".js"],

        plugins: [new TsconfigPathsPlugin()],
    },
    entry: "./src/electron/main.ts",
    module: {
        rules,
    },
    plugins: [...plugins, nativeAssetRuntimePlugin],
    optimization: {
        minimize: false,
    },
    devtool: "source-map",
};
