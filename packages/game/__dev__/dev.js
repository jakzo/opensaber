const fs = require("fs");
const path = require("path");

const esbuild = require("esbuild");
const httpServer = require("http-server");
const { Server } = require("ws");

const { esbuildOpts } = require("../build");

const server = httpServer.createServer({
  root: __dirname,
  cache: -1,
});
server.listen(8080);
server.server.on("listening", () => {
  console.log("Dev server listening at: http://localhost:8080");
});

const wss = new Server({ port: 11123 });
wss.on("connection", (ws) => {
  ws.on("message", async (msgRaw) => {
    try {
      const msg = JSON.parse(msgRaw);
      if (msg.recording) {
        await fs.promises.writeFile(
          path.join(__dirname, "testing", "recording.bin"),
          Buffer.from(msg.recording, "base64")
        );
        console.log("Recording saved");
      }
    } catch {
      console.error(
        `Error reading message from frontend: ${
          msgRaw.length > 1000 ? "(big message)" : msgRaw
        }`
      );
    }
  });
});

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
