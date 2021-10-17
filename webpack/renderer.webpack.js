module.exports = {
    resolve: {
        extensions: [".ts", ".tsx"],
    },
    module: {
        rules: require("./rules.webpack"),
    },
};
