export interface Level {
  /** Title of the audio. */
  title: string;
  /** Subtitle of the audio (eg. remix name or featured artists). */
  subtitle?: string;
  /** Name of the artist of the audio. */
  artist: string;
  /** Name of the user that created this level. */
  mapper: string;
  /** Level definitions grouped by type (eg. standard or 360) and difficulty. */
  maps: Record<LevelType | string, LevelDifficulty[]>;
  /** Custom data used by mods. */
  customData?: Record<string, unknown>;
}

export interface LevelDifficulty {
  /** Custom name of the difficulty. */
  name?: string;
  /** Speed that objects move in meters per second. */
  speed?: number;
  /** The distance in meters objects spawn in front of the player. */
  jumpOffset?: number;
  /** Objects in the level like note blocks and obstacles. */
  objects: LevelObject[];
  /** Custom data used by mods. */
  customData?: Record<string, unknown>;
}

export type LevelType = "standard";

export type LevelObject = LevelObjectCustom | LevelObjectBlock;
export interface LevelObjectCustom extends LevelObjectProps {
  type: LevelObjectType.CUSTOM;
}
export interface LevelObjectBlock
  extends LevelObjectProps<"x" | "y" | "rot" | "cd"> {
  type: LevelObjectTypeBlock;
  anyDir?: boolean;
}
export type LevelObjectTypeBlock =
  | LevelObjectType.BLOCK_LEFT
  | LevelObjectType.BLOCK_RIGHT;

type LevelObjectProps<
  K extends Exclude<keyof LevelObjectCommon, "time"> = never
> = Pick<LevelObjectCommon, K | "time">;
interface LevelObjectCommon {
  /** Time of object in milliseconds from song start. */
  time: number;
  /** Left/right position in meters. 0 is the middle. */
  x: number;
  /** Up/down position in meters. 0 is eye level when player is at full height. */
  y: number;
  /** Rotation between 0 and 359. 0 is pointing up, 180 is down. */
  rot: number;
  /** Custom data used by mods. */
  cd?: Record<string, unknown>;
}

export enum LevelObjectType {
  CUSTOM = "CUSTOM",
  BLOCK_LEFT = "BLOCK_LEFT",
  BLOCK_RIGHT = "BLOCK_RIGHT",
}
