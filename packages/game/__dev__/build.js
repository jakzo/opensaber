const path = require("path");

const { pnpPlugin } = require("@yarnpkg/esbuild-plugin-pnp");
const esbuild = require("esbuild");
// const { Server } = require("ws");

// const wss = new Server({ port: 11123 });

esbuild
  .build({
    plugins: [pnpPlugin()],
    entryPoints: [path.join(__dirname, "index.ts")],
    bundle: true,
    outfile: path.join(__dirname, "dist", "bundle.js"),
    // Not working?
    // watch: {
    //   onRebuild(err, result) {
    //     if (err) console.error("watch build failed:", err);
    //     else console.log("watch build succeeded:", result);
    //     for (const ws of wss.clients) ws.send("reload");
    //   },
    // },
  })
  .catch(() => process.exit(1));
