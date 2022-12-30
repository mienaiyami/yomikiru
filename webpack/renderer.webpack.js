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
    target: 'electron-renderer'
    // target: "web",
};