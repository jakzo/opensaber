import * as THREE from "three";

import {
  BLOCK_DEFAULT_OPTS,
  BlockMeshes,
  BlockOpts,
  createBlockMeshes,
} from "./block";
import { PositionRotation, calculateCut } from "./collision";
import {
  Level,
  LevelDifficulty,
  LevelObject,
  LevelObjectType,
  LevelObjectTypeBlock,
  LevelType,
} from "./level";
import {
  SABER_DEFAULT_OPTS,
  SaberMeshes,
  SaberOpts,
  createSaberMeshes,
} from "./saber";
import { SomeRequired, withDefaults } from "./utils";

/** Distance behind the player that objects disappear at. */
const REAR_DESPAWN_DISTANCE = 5;
/** Distance in front of the player where blocks are expected to be hit. */
const BEAT_Z_OFFSET = 1.5;

const DEFAULT_BLOCK_HITBOX = new THREE.Box3(
  new THREE.Vector3(-0.5, -0.5, -0.5),
  new THREE.Vector3(0.5, 0.5, 0.5)
);

export interface Player {
  headset: THREE.Object3D;
  controllers: THREE.Object3D[];
}

type SaberPositions = Record<LevelObjectTypeBlock, PositionRotation>;

export type LevelStateOpts = SomeRequired<
  LevelStateProps,
  "level" | "type" | "difficulty"
>;
interface LevelStateProps {
  level: Level;
  type: LevelType | string;
  difficulty: LevelDifficulty;
  /** Start position in the level in seconds. Can be negative. */
  startTime: number;
  /** Speed the level is playing at with 1.0 being normal speed. */
  speed: number;
  /** If the level is currently playing (ie. not paused). */
  isPlaying: boolean;
  /** Block options. */
  block: Partial<BlockOpts>;
  /** Saber options. */
  saber: Partial<SaberOpts>;
}

interface LevelStateExtraProps {
  /** Saber game objects. */
  sabers: Record<LevelObjectTypeBlock, THREE.Object3D>;
}

export interface LevelState extends LevelStateProps, LevelStateExtraProps {}
export class LevelState {
  gameObjects: Map<LevelObject, THREE.Object3D>;
  /** Index of the first object in `difficulty.objects` which is currently
   * rendered. If no objects are currently rendered it is 0. If there are no
   * more objects it is the length of `difficulty.objects`. */
  objIdx: number;
  meshCache: { blocks: BlockMeshes; sabers: SaberMeshes };
  /** Current position in the level in seconds. Can be negative. */
  time: number;
  /** The distance in meters objects spawn in front of the player. */
  jumpOffset: number;
  /** Speed that objects move in meters per second. */
  objSpeed: number;
  obj: THREE.Object3D;
  levelObjs: THREE.Group;
  /** Y position of eyes when player is at full height. */
  playerHeightY: number;
  saber: SaberOpts;
  block: BlockOpts;
  prevTime: number;
  prevSaberPos?: SaberPositions;
  currentLevelObjects: Set<LevelObject>;

  promise: Promise<void>;
  private promiseResolve: () => void;
  private promiseReject: (err: unknown) => void;

  constructor({
    level,
    type,
    difficulty,
    startTime = -1,
    speed = 1,
    isPlaying = true,
    block = {},
    saber = {},
    sabers,
  }: LevelStateOpts & LevelStateExtraProps) {
    const blockOpts = withDefaults(BLOCK_DEFAULT_OPTS, block);
    const saberOpts = withDefaults(
      { ...SABER_DEFAULT_OPTS, blockColors: blockOpts.blockColors },
      saber
    );
    const saberMeshes = createSaberMeshes(saberOpts);
    Object.assign(this, {
      level,
      type,
      difficulty,
      startTime,
      speed,
      isPlaying,
      gameObjects: new Map<LevelObject, THREE.Object3D>(),
      objIdx: 0,
      meshCache: { blocks: createBlockMeshes(blockOpts), sabers: saberMeshes },
      time: startTime,
      jumpOffset: difficulty.jumpOffset ?? 10,
      objSpeed: difficulty.speed ?? 5,
      obj: new THREE.Group(),
      levelObjs: new THREE.Group(),
      playerHeightY: 1.7,
      block: blockOpts,
      saber: saberOpts,
      sabers,
      currentLevelObjects: new Set(),
    });
    this.obj.add(this.levelObjs);
    this.promise = new Promise((resolve, reject) => {
      this.promiseResolve = resolve;
      this.promiseReject = reject;
    });
  }

  updateTime(timeDelta: number): void {
    this.prevTime = this.time;
    if (this.time >= 0 && this.time < this.level.audio.duration) {
      if (this.isPlaying && !this.level.audio.paused) {
        this.time = this.level.audio.currentTime;
      }
    } else if (this.isPlaying) {
      this.time += timeDelta * this.speed;
    }
  }

  updatePhysics(player: Player): void {
    const {
      level,
      gameObjects,
      meshCache,
      playerHeightY,
      difficulty,
      objSpeed,
      speed,
      jumpOffset,
    } = this;
    const getGameObj = (levelObj: LevelObject): THREE.Object3D =>
      gameObjects.get(levelObj) || createGameObj(levelObj);

    const createGameObj = (levelObj: LevelObject): THREE.Object3D => {
      switch (levelObj.type) {
        case LevelObjectType.BLOCK_LEFT:
        case LevelObjectType.BLOCK_RIGHT: {
          const blocks = meshCache.blocks[levelObj.type];
          const baseBlock = levelObj.anyDir ? blocks.dot : blocks.arrow;
          const obj = baseBlock.clone();
          obj.position.x = levelObj.x;
          obj.position.y = playerHeightY + levelObj.y;
          obj.rotateZ((levelObj.rot / 360) * Math.PI * 2);
          this.levelObjs.add(obj);
          gameObjects.set(levelObj, obj);
          return obj;
        }
        default: {
          throw new Error(`Unknown level object of type: ${levelObj.type}`);
        }
      }
    };

    const levelObjects = difficulty.objects;

    const deleteLevelObject = (lo: LevelObject): void => {
      this.currentLevelObjects.delete(lo);
      gameObjects.get(lo)?.removeFromParent();
      gameObjects.delete(lo);
    };

    if (
      this.time >= 0 &&
      this.time < level.audio.duration &&
      this.isPlaying &&
      level.audio.paused
    ) {
      level.audio.currentTime = this.time;
      level.audio.volume = 0.8;
      level.audio.playbackRate = speed;
      level.audio.play().catch(this.promiseReject);
      level.audio.addEventListener("ended", () => {
        this.isPlaying = false;
        this.promiseResolve();
      });
    }

    if (this.prevSaberPos)
      for (const pos of Object.values(this.prevSaberPos))
        pos.position.z += this.time - this.prevTime;

    while (this.objIdx < levelObjects.length) {
      const lo = levelObjects[this.objIdx];
      const z = (this.time - lo.time / 1000) * objSpeed;
      if (z < -jumpOffset) break;
      this.currentLevelObjects.add(lo);
      this.objIdx++;
    }

    this.computeSaberBoundingBoxes();
    for (const lo of this.currentLevelObjects) {
      const z = (this.time - lo.time / 1000) * objSpeed;
      const prevZ = (this.prevTime - lo.time / 1000) * objSpeed;

      // TODO: This should be different to z for walls
      const zEnd = z;
      if (zEnd > REAR_DESPAWN_DISTANCE) {
        deleteLevelObject(lo);
        continue;
      }
      const go = getGameObj(lo);
      go.position.z = z + player.headset.position.z - BEAT_Z_OFFSET;

      if (
        (lo.type === LevelObjectType.BLOCK_LEFT ||
          lo.type === LevelObjectType.BLOCK_RIGHT) &&
        this.prevSaberPos
      ) {
        const cut = calculateCut(
          go,
          this.sabers[lo.type],
          this.prevSaberPos[lo.type],
          this.saber,
          DEFAULT_BLOCK_HITBOX
        );
        if (cut) {
          deleteLevelObject(lo);
          console.log("cut", cut);
        }
      }
    }

    if (!this.prevSaberPos)
      this.prevSaberPos = Object.fromEntries(
        [LevelObjectType.BLOCK_LEFT, LevelObjectType.BLOCK_RIGHT].map((type): [
          LevelObjectType,
          PositionRotation
        ] => [
          type,
          { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() },
        ])
      ) as SaberPositions;
    for (const type of [
      LevelObjectType.BLOCK_LEFT,
      LevelObjectType.BLOCK_RIGHT,
    ] as const) {
      this.prevSaberPos[type].position.copy(this.sabers[type].position);
      this.prevSaberPos[type].quaternion.copy(this.sabers[type].quaternion);
    }
  }

  /**
   * Bounding box around each saber at its current position and at its
   * position in the previous frame. Box includes padding which is the
   * width of a block so that any block touching a saber is guaranteed
   * inside the bounding box when we only check the center position of a block.
   */
  saberBoundingBox: Record<LevelObjectTypeBlock, THREE.Box3>;
  computeSaberBoundingBoxes(): void {
    this.saberBoundingBox = Object.fromEntries(
      Object.entries(this.sabers).map(([type, saber]) => {
        const a = new THREE.Vector3(1, 1, 1).multiplyScalar(this.block.width);
        const b = new THREE.Vector3(-1, -1, -1).multiplyScalar(
          this.block.width
        );
        const saberEnd = new THREE.Vector3(0, 0, this.saber.saberLength)
          .applyQuaternion(saber.quaternion)
          .add(saber.position);
        return [
          type,
          new THREE.Box3().setFromPoints([
            new THREE.Vector3().copy(saber.position).add(a),
            new THREE.Vector3().copy(saber.position).add(b),
            new THREE.Vector3().copy(saberEnd).add(a),
            new THREE.Vector3().copy(saberEnd).add(b),
          ]),
        ];
      })
    ) as Record<LevelObjectTypeBlock, THREE.Box3>;
  }
}
