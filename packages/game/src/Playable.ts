import * as THREE from "three";

import { Player } from "./LevelState";

export abstract class Playable {
  abstract setStopped(isStopped: boolean): void;
  abstract obj: THREE.Object3D;
  abstract animate: (timeDelta: number, player: Player) => void;
}
