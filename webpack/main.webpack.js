const { IgnorePlugin } = require('webpack');

const optionalPlugins = [];
if (process.platform !== "darwin") {
  optionalPlugins.push(new IgnorePlugin({ resourceRegExp: /^fsevents$/ }));
}

module.exports = {
    resolve: {
        extensions: [".ts", ".js"],
    },
    entry: "./electron/main.ts",
    module: {
        rules: require("./rules.webpack"),
    },
    plugins:[...optionalPlugins]
};
