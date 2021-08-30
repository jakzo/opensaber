import * as THREE from "three";

import { LevelState, LevelStateOpts, Player } from "./LevelState";
import { Playable } from "./Playable";
import { LevelObjectType } from "./level";

// recording frame = [time] + [position X, Y, Z, rotation quaternion X, Y, Z, W] * [headset, right controller, left controller]
export const RECORDING_OBJ_FRAME_SIZE = 7;
export const RECORDING_FRAME_SIZE = 1 + RECORDING_OBJ_FRAME_SIZE * 3;
const RECORDING_BUFFER_SIZE = 1024 * RECORDING_FRAME_SIZE;

export interface PlayLevelOpts {
  levelState: LevelStateOpts;
  controllers: THREE.Group[];
}

export class PlayLevel implements Playable {
  obj: THREE.Object3D;
  levelState: LevelState;
  controllers: THREE.Group[];
  recordingBuffers = [new Float64Array(RECORDING_BUFFER_SIZE)];
  /** Current frame index in the most recent recording buffer. */
  recordingBufferIdx = 0;

  constructor(opts: PlayLevelOpts) {
    this.levelState = new LevelState({
      ...opts.levelState,
      sabers: {
        [LevelObjectType.BLOCK_LEFT]: opts.controllers[0],
        [LevelObjectType.BLOCK_RIGHT]: opts.controllers[1],
      },
    });
    this.obj = this.levelState.obj;
    this.controllers = opts.controllers;

    const { sabers } = this.levelState.meshCache;
    for (const [controllerIdx, saber] of [
      sabers.BLOCK_LEFT,
      sabers.BLOCK_RIGHT,
    ].entries()) {
      this.controllers[controllerIdx].add(saber);
    }
  }

  setStopped(isStopped: boolean): void {
    this.levelState.isPlaying = !isStopped;
    if (isStopped) this.levelState.level.audio.pause();
  }

  animate = (timeDelta: number, player: Player): void => {
    this.levelState.updateTime(timeDelta);
    this.levelState.updatePhysics(player);

    const recordingBuffer = this.recordingBuffers[
      this.recordingBuffers.length - 1
    ];
    let idx = this.recordingBufferIdx;
    recordingBuffer[idx++] = this.levelState.time;
    for (const obj of [
      player.headset,
      player.controllers[0],
      player.controllers[1],
    ]) {
      recordingBuffer.set(
        [
          obj.position.x,
          obj.position.y,
          obj.position.z,
          obj.quaternion.x,
          obj.quaternion.y,
          obj.quaternion.z,
          obj.quaternion.w,
        ],
        idx
      );
      idx += RECORDING_OBJ_FRAME_SIZE;
    }
    this.recordingBufferIdx = idx;
    if (idx >= recordingBuffer.length) {
      this.recordingBuffers.push(new Float64Array(RECORDING_BUFFER_SIZE));
      this.recordingBufferIdx = 0;
    }
  };

  createRecording(): Float64Array {
    const recording = new Float64Array(
      this.recordingBuffers.length * RECORDING_BUFFER_SIZE +
        this.recordingBufferIdx
    );
    for (const [i, buffer] of this.recordingBuffers.entries())
      recording.set(buffer, i * RECORDING_BUFFER_SIZE);
    return recording;
  }
}
