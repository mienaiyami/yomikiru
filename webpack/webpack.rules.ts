import type { ModuleOptions } from "webpack";

export const rules: Required<ModuleOptions>["rules"] = [
    {
        test: /native_modules[/\\].+\.node$/,
        use: "node-loader",
    },
    {
        test: /[/\\]node_modules[/\\].+\.(m?js|node)$/,
        parser: { amd: false },
        use: {
            loader: "@vercel/webpack-asset-relocator-loader",
            options: {
                outputAssetBase: "native_modules",
            },
        },
    },
    {
        test: /\.tsx?$/,
        /*
         * Skip deps, Forge output, and test/e2e sources if webpack resolves them
         * so they never enter the pack. ts-loader still typechecks the tsconfig
         * program; do not set onlyCompileBundledFiles (that drops ambient .d.ts).
         */
        exclude: /(node_modules|\.webpack|\.test\.tsx?$|[\\/]e2e[\\/]|[\\/]src[\\/]test[\\/])/,
        use: {
            loader: "ts-loader",
            // use this or `ForkTsCheckerWebpackPlugin` in `webpack/plugins.ts`
            options: {
                // transpileOnly: true,
            },
        },
    },
    {
        test: /\.(css|sass|scss)$/,
        use: ["style-loader", "css-loader", "sass-loader"],
    },
    {
        test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
        type: "asset/resource",
    },
    // {
    //     test: /\.worker\.js$/i,
    //     loader: "worker-loader",
    //     options: {
    //         filename: "[name].js",
    //     },
    // },
    {
        test: /pdf\.worker\.js/,
        loader: "file-loader",
        options: {
            name: "[name].[ext]",
        },
    },
];
