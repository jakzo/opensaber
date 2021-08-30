import * as THREE from "three";

import { LevelState, LevelStateOpts, Player } from "./LevelState";
import { RECORDING_FRAME_SIZE, RECORDING_OBJ_FRAME_SIZE } from "./PlayLevel";
import { Playable } from "./Playable";
import { LevelObjectType } from "./level";

export interface ReplayOpts {
  /** Recording of controller and headset positions/rotations to play back. */
  recording: Float64Array;
  levelState: LevelStateOpts;
  onRecording?: (recording: Float64Array) => void;
  /** Object to update with the position of the headset. */
  headset?: THREE.Object3D;
}

export class Replay implements Playable {
  opts: ReplayOpts;
  obj: THREE.Object3D;
  levelState: LevelState;
  /** Index of current position item in recording. */
  private recordingIdx = 0;
  recordedControllers: THREE.Group[] = [new THREE.Group(), new THREE.Group()];
  headset: THREE.Object3D;

  constructor(opts: ReplayOpts) {
    this.opts = opts;
    this.levelState = new LevelState({
      ...opts.levelState,
      sabers: {
        [LevelObjectType.BLOCK_LEFT]: this.recordedControllers[0],
        [LevelObjectType.BLOCK_RIGHT]: this.recordedControllers[1],
      },
    });
    this.headset = opts.headset ?? createReplayHeadset(this.levelState.obj);
    this.obj = this.levelState.obj;
    const { sabers } = this.levelState.meshCache;
    for (const [controllerIdx, saber] of [
      sabers.BLOCK_LEFT,
      sabers.BLOCK_RIGHT,
    ].entries()) {
      const recController = this.recordedControllers[controllerIdx];
      recController.add(saber);
      this.levelState.obj.add(recController);
    }
  }

  setStopped(isStopped: boolean): void {
    this.levelState.isPlaying = !isStopped;
    if (isStopped) this.levelState.level.audio.pause();
  }

  animate = (timeDelta: number, player: Player): void => {
    this.levelState.updateTime(timeDelta);

    if (this.levelState.isPlaying) {
      while (this.opts.recording[this.recordingIdx] < this.levelState.time)
        this.recordingIdx += RECORDING_FRAME_SIZE;

      const idx = this.recordingIdx + 1;
      this.headset.position.fromArray(
        this.opts.recording.subarray(idx, idx + 3)
      );
      this.headset.quaternion.fromArray(
        this.opts.recording.subarray(idx + 3, idx + 7)
      );

      for (let controllerIdx = 0; controllerIdx < 2; controllerIdx++) {
        const controller = this.recordedControllers[controllerIdx];
        const idx =
          this.recordingIdx +
          1 +
          (controllerIdx + 1) * RECORDING_OBJ_FRAME_SIZE;
        controller.position.fromArray(
          this.opts.recording.subarray(idx, idx + 3)
        );
        controller.quaternion.fromArray(
          this.opts.recording.subarray(idx + 3, idx + 7)
        );
      }
    }

    this.levelState.updatePhysics(player);
  };
}

const createReplayHeadset = (levelObj: THREE.Object3D): THREE.Mesh => {
  const headset = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.1, 0.1),
    new THREE.MeshPhongMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.6,
    })
  );
  levelObj.add(headset);
  return headset;
};
