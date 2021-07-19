const path = require("path");

const { pnpPlugin } = require("@yarnpkg/esbuild-plugin-pnp");

const esbuildOpts = {
  plugins: [pnpPlugin()],
  entryPoints: [path.join(__dirname, "src", "index.ts")],
  bundle: true,
  outfile: path.join(__dirname, "dist", "bundle.js"),
  target: "es2018",
  sourcemap: "external",
  minify: true,
  sourceRoot: path.join(__dirname, "..", ".."),
};

module.exports = { esbuildOpts };

if (require.main === module)
  require("esbuild")
    .build(esbuildOpts)
    .catch(() => process.exit(1));
