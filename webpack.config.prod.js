// PROD
const path = require("path");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  entry: {
    content: path.join(__dirname, "src", "extension", "content.ts"),
    background: path.join(__dirname, "src", "extension", "background.ts"),
  },
  mode: "production",
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
              configFile: "tsconfig.extension.json",
            },
          },
        ],
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
    modules: [path.resolve(__dirname, "src", "extension"), "node_modules"],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "build"),
  },
  optimization: {
    minimize: true,
    concatenateModules: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
          },
          mangle: true,
          format: {
            comments: false,
          },
        },
        extractComments: false,
      }),
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.REACT_APP_BASE_API_URL": JSON.stringify(
        "${process.env.REACT_APP_BASE_API_URL}"
      ),
    }),
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
  ],
};
