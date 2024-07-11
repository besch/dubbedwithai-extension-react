// PROD
const path = require("path");
const webpack = require("webpack");

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
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "build"),
  },
  optimization: {
    minimize: true,
    concatenateModules: true,
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

// //  DEV
// const path = require("path");
// const webpack = require("webpack");

// module.exports = {
//   entry: {
//     content: path.join(__dirname, "src", "extension", "content.ts"),
//     background: path.join(__dirname, "src", "extension", "background.ts"),
//   },
//   mode: "development", // Changed from "production" to "development"
//   module: {
//     rules: [
//       {
//         test: /\.ts$/,
//         use: [
//           {
//             loader: "ts-loader",
//             options: {
//               transpileOnly: true,
//               configFile: "tsconfig.extension.json",
//             },
//           },
//         ],
//         exclude: /node_modules/,
//       },
//     ],
//   },
//   resolve: {
//     extensions: [".ts", ".js"],
//     modules: [path.resolve(__dirname, "src", "extension"), "node_modules"],
//   },
//   output: {
//     filename: "[name].js",
//     path: path.resolve(__dirname, "build"),
//   },
//   optimization: {
//     minimize: false, // Disable minimization
//     concatenateModules: true,
//   },
//   plugins: [
//     new webpack.optimize.LimitChunkCountPlugin({
//       maxChunks: 1,
//     }),
//   ],
//   devtool: "source-map", // Add source map for better debugging
// };
