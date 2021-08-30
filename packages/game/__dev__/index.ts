import { Game } from "../src/Game";
import { readBeatsaberMap } from "../src/import-beatsaber";
import { startCollisionDebugger } from "./collision-debugger";

void (async () => {
  let devWs: WebSocket;
  let retryTime = 1000;
  const connect = (isReconnect: boolean): void => {
    devWs = new WebSocket(
      `ws://${window.location.hostname || "localhost"}:11123`
    );
    devWs.addEventListener("open", () => {
      console.log(`Dev server ${isReconnect ? "re" : ""}connected`);
      retryTime = 1000;
    });
    devWs.addEventListener("message", (evt) => {
      if (evt.data === "reload") {
        console.log("Received reload message from dev server...");
        window.location.reload();
      }
    });
    devWs.addEventListener("close", () => {
      if (!isReconnect) console.warn("Dev server disconnected");
      retryTime = Math.min(retryTime * 1.2, 60 * 1000);
      setTimeout(() => connect(true), retryTime);
    });
  };
  connect(false);

  const SHOW_COLLISION_DEBUGGER = false;

  if (SHOW_COLLISION_DEBUGGER) {
    startCollisionDebugger(document.body);
  } else {
    const resSong = await fetch("./testing/you_and_i.zip");
    const mapZip = await resSong.arrayBuffer();
    const sampleLevel = await readBeatsaberMap(mapZip);
    const resRecording = await fetch("./testing/recording.bin");
    const arrayBuffer = await resRecording.arrayBuffer();
    const recording = new Float64Array(arrayBuffer);
    const game = new Game({
      container: document.body,
      showStats: true,
    }).startGame();
    setTimeout(() => game.stopGame(), 100);

    const PLAY_RECORDING = true;

    const startLevel = async (): Promise<void> => {
      document.removeEventListener("mousedown", startLevel);
      game.startGame();
      if (PLAY_RECORDING) {
        await game.playbackRecording({
          levelState: {
            level: sampleLevel,
            type: "standard",
            difficulty: sampleLevel.maps.standard[2],
            startTime: 0,
            speed: 1,
          },
          recording,
          headsetPerspective: false,
        });
      } else {
        const { createRecording } = await game.playLevel({
          level: sampleLevel,
          type: "standard",
          difficulty: sampleLevel.maps.standard[2],
          startTime: 0,
          speed: 1,
        });
        const recording = createRecording();
        console.log("Sending recording...");
        devWs.send(
          JSON.stringify({
            recording: btoa(
              new Uint8Array(recording.buffer).reduce(
                (str, byte) => str + String.fromCharCode(byte),
                ""
              )
            ),
          })
        );
      }
    };
    document.addEventListener("mousedown", startLevel);
    document.addEventListener("keydown", (evt) => {
      if (evt.key === " ") {
        if (game.isStopped) game.startGame();
        else game.stopGame();
      }
    });
  }
})();
