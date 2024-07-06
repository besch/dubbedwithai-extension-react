const path = require("path");
const webpack = require("webpack");
const fs = require("fs");

const idbCode = fs.readFileSync(require.resolve("idb"), "utf8");

module.exports = {
  entry: {
    content: path.join(__dirname, "src", "extension", "content.ts"),
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
              compilerOptions: {
                module: "es6",
              },
            },
          },
        ],
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
    modules: [path.resolve(__dirname, "src"), "node_modules"],
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "build"),
  },
  plugins: [
    new webpack.DefinePlugin({
      IDB_RAW: JSON.stringify(idbCode),
    }),
  ],
};
