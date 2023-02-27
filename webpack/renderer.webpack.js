const { IgnorePlugin } = require('webpack');

const optionalPlugins = [];
if (process.platform !== "darwin") {
  optionalPlugins.push(new IgnorePlugin({ resourceRegExp: /^fsevents$/ }));
}


module.exports = {
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
    },
    module: {
        rules: require("./rules.webpack"),
    },
    externals: {
        electron: 'commonjs2 electron',
    },
    target: 'electron-renderer',
    plugins:[...optionalPlugins]
    // target: "web",
};