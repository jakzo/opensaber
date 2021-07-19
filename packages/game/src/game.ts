import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Stats from "three/examples/jsm/libs/stats.module";

import { MeshCacheBlocks, createBlockMeshes } from "./block";
import {
  Level,
  LevelDifficulty,
  LevelObject,
  LevelObjectType,
  LevelType,
} from "./level";
import { createStage } from "./stage";

type SomeRequired<T, RequiredK extends keyof T> = Pick<T, RequiredK> &
  Partial<Omit<T, RequiredK>>;

export interface GameOpts {
  container: HTMLElement;
  showStats?: boolean;
}

export interface Game {
  startGame(): Game;
  stopGame(): Game;
  startLevel(
    opts: SomeRequired<LevelStateOpts, "level" | "type" | "difficulty">
  ): Game;
}

interface LevelStateOpts {
  level: Level;
  type: LevelType | string;
  difficulty: LevelDifficulty;
  /** Start position in the level in seconds. Can be negative. */
  startTime: number;
  /** Speed the level is playing at with 1.0 being normal speed. */
  speed: number;
  /** If the level is currently playing (ie. not paused). */
  isPlaying: boolean;
}
/** This contains level state including internal state like 3D objects which are
 * in the scene. */
interface LevelState extends LevelStateOpts {
  gameObjects: Map<LevelObject, THREE.Object3D>;
  /** Index of the first object in `difficulty.objects` which is currently
   * rendered. If no objects are currently rendered it is 0. If there are no
   * more objects it is the length of `difficulty.objects`. */
  objIdx: number;
  meshCache: { blocks: MeshCacheBlocks };
  /** Current position in the level in seconds. Can be negative. */
  time: number;
  /** The distance in meters objects spawn in front of the player. */
  jumpOffset: number;
  /** Speed that objects move in meters per second. */
  objSpeed: number;
  parentObj: THREE.Object3D;
  /** Y position of eyes when player is at full height. */
  playerHeightY: number;
}

/** Distance behind the player that objects disappear at. */
const REAR_DESPAWN_DISTANCE = 5;

export const createGame = (opts: GameOpts): Game => {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, 1.6, 0);
  camera.lookAt(0, 0, 1000);

  const ambientLight = new THREE.AmbientLight(0xcccccc, 0.4);
  scene.add(ambientLight);

  for (const [x, y, z] of [
    [2, 2, 0],
    [-2, 2, 0],
  ]) {
    const light = new THREE.DirectionalLight(0xffffff, 0.4);
    light.position.set(x, y, z);
    scene.add(light);
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  const setSize = (): void => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(opts.container.clientWidth, opts.container.clientHeight);
  };
  setSize();
  new ResizeObserver(setSize).observe(opts.container);
  opts.container.append(renderer.domElement);

  const stats = opts.showStats ? Stats() : undefined;
  if (stats) opts.container.appendChild(stats.dom);

  const stage = createStage();
  scene.add(stage);

  const orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.target = new THREE.Vector3(0, 1, 10);
  orbitControls.update();

  let levelState: LevelState | undefined;
  let timePrev: number | undefined;

  let animationFrameHandle: number | undefined;
  const animate = (time: number): void => {
    stats?.begin();
    animationFrameHandle = requestAnimationFrame(animate);

    if (timePrev === undefined) timePrev = time;
    const timeDelta = (time - timePrev) / 1000;

    const playerZ = 0;

    if (levelState) {
      const untouchedObjs = new Set(levelState.gameObjects.keys());
      const levelObjects = levelState.difficulty.objects;
      if (levelState.isPlaying) levelState.time += timeDelta * levelState.speed;
      if (levelState.objIdx < levelObjects.length) {
        for (let i = levelState.objIdx; i < levelObjects.length; i++) {
          const lo = levelObjects[i];
          const z = (levelState.time - lo.time / 1000) * levelState.objSpeed;
          // TODO: This should be different to z for walls
          const zEnd = z;
          if (zEnd > REAR_DESPAWN_DISTANCE) {
            levelState.objIdx = i + 1;
            continue;
          }
          if (z < -levelState.jumpOffset) break;
          const go = getGameObj(levelState, lo);
          go.position.z = -z + playerZ;
          untouchedObjs.delete(lo);
        }
      }

      for (const lo of untouchedObjs) {
        levelState.gameObjects.get(lo)?.removeFromParent();
        levelState.gameObjects.delete(lo);
      }
    }

    renderer.render(scene, camera);

    timePrev = time;

    stats?.end();
  };

  const game: Game = {
    startGame() {
      if (animationFrameHandle === undefined)
        animationFrameHandle = requestAnimationFrame(animate);
      return game;
    },
    stopGame() {
      if (animationFrameHandle !== undefined) {
        cancelAnimationFrame(animationFrameHandle);
        animationFrameHandle = undefined;
      }
      return game;
    },
    startLevel({
      level,
      type,
      difficulty,
      startTime = -1,
      speed = 1,
      isPlaying = true,
    }: LevelStateOpts) {
      levelState = {
        level,
        type,
        difficulty,
        startTime,
        speed,
        isPlaying,
        gameObjects: new Map<LevelObject, THREE.Object3D>(),
        objIdx: 0,
        meshCache: { blocks: createBlockMeshes() },
        time: startTime,
        jumpOffset: difficulty.jumpOffset ?? 20,
        objSpeed: difficulty.speed ?? 5,
        parentObj: new THREE.Object3D(),
        playerHeightY: 1.6,
      };
      scene.add(levelState.parentObj);
      return game;
    },
  };
  return game;
};

const getGameObj = (
  levelState: LevelState,
  levelObj: LevelObject
): THREE.Object3D =>
  levelState.gameObjects.get(levelObj) || createGameObj(levelState, levelObj);

const createGameObj = (
  levelState: LevelState,
  levelObj: LevelObject
): THREE.Object3D => {
  switch (levelObj.type) {
    case LevelObjectType.BLOCK_LEFT:
    case LevelObjectType.BLOCK_RIGHT: {
      const blocks = levelState.meshCache.blocks[levelObj.type];
      const baseBlock = levelObj.anyDir ? blocks.dot : blocks.arrow;
      const obj = baseBlock.clone();
      obj.position.x = levelObj.x;
      obj.position.y = levelState.playerHeightY + levelObj.y;
      obj.rotateZ((levelObj.rot / 360) * Math.PI * 2);
      levelState.parentObj.add(obj);
      levelState.gameObjects.set(levelObj, obj);
      return obj;
    }
    default: {
      throw new Error(`Unknown level object of type: ${levelObj.type}`);
    }
  }
};
