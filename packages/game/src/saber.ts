import * as THREE from "three";

import { BLOCK_DEFAULT_OPTS, BlockColors } from "./block";
import { LevelObjectType, LevelObjectTypeBlock } from "./level";
import { withDefaults } from "./utils";

export type SaberMeshes = Record<LevelObjectTypeBlock, THREE.Mesh>;

export interface SaberOpts {
  blockColors: BlockColors;
  bladeRadiusBase: number;
  bladeRadiusTip: number;
  saberLength: number;
  handleLength: number;
}

export const SABER_DEFAULT_OPTS: SaberOpts = {
  blockColors: BLOCK_DEFAULT_OPTS.blockColors,
  bladeRadiusBase: 0.02,
  bladeRadiusTip: 0.01,
  saberLength: 1.5,
  handleLength: 0.2,
};

export const createSaberMeshes = (opts: Partial<SaberOpts>): SaberMeshes => {
  const {
    blockColors,
    bladeRadiusBase,
    bladeRadiusTip,
    saberLength,
    handleLength,
  } = withDefaults(SABER_DEFAULT_OPTS, opts);
  const blade = new THREE.CylinderGeometry(
    bladeRadiusTip,
    bladeRadiusBase,
    saberLength - handleLength / 2,
    16,
    1,
    false
  );
  blade.translate(0, saberLength / 2 + handleLength / 4, 0);
  blade.rotateX(Math.PI / -2);
  return {
    [LevelObjectType.BLOCK_LEFT]: new THREE.Mesh(
      blade,
      new THREE.MeshPhongMaterial({
        color: blockColors[LevelObjectType.BLOCK_LEFT],
      })
    ),
    [LevelObjectType.BLOCK_RIGHT]: new THREE.Mesh(
      blade,
      new THREE.MeshPhongMaterial({
        color: blockColors[LevelObjectType.BLOCK_RIGHT],
      })
    ),
  };
};
