const path = require("path");

const esbuild = require("esbuild");
const { Server } = require("ws");

const { esbuildOpts } = require("../build");

const wss = new Server({ port: 11123 });

esbuild
  .build({
    ...esbuildOpts,
    // Can remove the local copy once this PR is merged
    // https://github.com/yarnpkg/berry/pull/2919
    plugins: [require("./esbuild-pnp").pnpPlugin()],
    entryPoints: [path.join(__dirname, "index.ts")],
    outfile: path.join(__dirname, "dist", "bundle.js"),
    minify: false,
    watch: {
      onRebuild(err) {
        if (!err) {
          console.log("Rebuild succeeded");
          for (const ws of wss.clients) ws.send("reload");
        } else {
          console.error("Rebuild failed");
        }
      },
    },
  })
  .then(() => console.log("Build succeeded"))
  .catch(() => console.error("Build failed"));
