const path = require(`path`);

module.exports = {
  webpack: {
    alias: {
      "@": path.resolve(__dirname, "src/"),
    },
    configure: (webpackConfig) => {
      webpackConfig.module.rules.push({
        test: /\.ts$/,
        exclude: /node_modules|extension/,
      });
      return webpackConfig;
    },
  },
};
