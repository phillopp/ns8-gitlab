module.exports = {
  publicPath: "./",
  configureWebpack: {
    optimization: {
      splitChunks: {
        minSize: 10000,
        maxSize: 250000,
      },
    },
    resolve: {
      fallback: {
        crypto: false,
      },
    },
  },
};
