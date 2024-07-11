const path = require(`path`);

module.exports = {
  webpack: {
    alias: {
      "@": path.resolve(__dirname, "src/"),
    },
  },
  babel: {
    plugins: [["transform-remove-console", { exclude: ["error", "warn"] }]],
  },
};
