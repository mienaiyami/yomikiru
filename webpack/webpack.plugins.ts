import { IgnorePlugin } from "webpack";
// const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

export const plugins = [
    // not working properly now
    // new ForkTsCheckerWebpackPlugin({
    //     logger: "webpack-infrastructure",
    // }),
    new IgnorePlugin({ resourceRegExp: /^fsevents$/ }),
];
