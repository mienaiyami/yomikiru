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
        exclude: /(node_modules|\.webpack)/,
        use: {
            loader: "ts-loader",
            // use this or `ForkTsCheckerWebpackPlugin` in `webpack/plugins.ts`
            options: {
                transpileOnly: true,
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
