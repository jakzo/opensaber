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
        objects: [...Array(3)]
          .flatMap(() =>
            [
              {
                x: -1,
                y: -1,
                rot: 180,
              },
              {
                x: -2,
                y: 0,
                rot: 90,
              },
              {
                x: -1,
                y: 1,
                rot: 45,
              },
            ].flatMap((obj) => [
              {
                type: LevelObjectType.BLOCK_LEFT,
                ...obj,
              },
              {
                type: LevelObjectType.BLOCK_RIGHT,
                x: -obj.x,
                y: -obj.y,
                rot: (obj.rot + 180) % 360,
              },
            ])
          )
          .map((obj, i) => ({ ...obj, time: 1000 + i * 500 })),
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
