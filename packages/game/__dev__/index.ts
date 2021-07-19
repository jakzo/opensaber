import { createGame } from "../src/game";
import { Level, LevelObjectType } from "../src/level";

{
  let retryTime = 1000;
  const connect = (isReconnect: boolean): void => {
    const liveReloadWs = new WebSocket(
      `ws://${window.location.host || "localhost"}:11123`
    );
    liveReloadWs.addEventListener("open", () => {
      console.log(`Live reload server ${isReconnect ? "re" : ""}connected`);
      retryTime = 1000;
    });
    liveReloadWs.addEventListener("message", (evt) => {
      if (evt.data === "reload") {
        console.log("Received reload message from server...");
        window.location.reload();
      }
    });
    liveReloadWs.addEventListener("close", () => {
      if (!isReconnect) console.warn("Live reload server disconnected");
      retryTime = Math.min(retryTime * 1.2, 60 * 1000);
      setTimeout(() => connect(true), retryTime);
    });
  };
  connect(false);
}

const sampleLevel: Level = {
  title: "Sample Level",
  artist: "jakzo",
  mapper: "jakzo",
  maps: {
    standard: [
      {
        objects: [...Array(10).keys()].flatMap((i) => [
          {
            time: i * 2000 + 3000,
            type: LevelObjectType.BLOCK_LEFT,
            x: -1,
            y: -1,
            rot: 180,
          },
          {
            time: i * 2000 + 4000,
            type: LevelObjectType.BLOCK_RIGHT,
            x: 1,
            y: -1,
            rot: 180,
          },
        ]),
      },
    ],
  },
};

createGame({ container: document.body, showStats: true })
  .startGame()
  .startLevel({
    level: sampleLevel,
    type: "standard",
    difficulty: sampleLevel.maps.standard[0],
  });
