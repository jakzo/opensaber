import * as THREE from "three";

import { LevelObjectType, LevelObjectTypeBlock } from "./level";

type BlockColors = Record<LevelObjectTypeBlock, number>;

const BLOCK_TEXTURE_SIZE = 512;
const BLOCK_COLORS_DEFAULT: BlockColors = {
  [LevelObjectType.BLOCK_LEFT]: 0xff3333,
  [LevelObjectType.BLOCK_RIGHT]: 0x3333ff,
};
const BLOCK_SIZE_DEFAULT = 0.8;

export type MeshCacheBlocks = Record<
  LevelObjectTypeBlock,
  Record<"arrow" | "dot", THREE.Mesh>
>;

export const createBlockMeshes = (
  blockColors: BlockColors = BLOCK_COLORS_DEFAULT,
  blockSize = BLOCK_SIZE_DEFAULT
): MeshCacheBlocks => {
  const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
  const createMeshes = (
    color: number
  ): MeshCacheBlocks[LevelObjectTypeBlock] => {
    const side = new THREE.MeshPhongMaterial({ color });
    const createMesh = (
      draw: (ctx: CanvasRenderingContext2D) => void
    ): THREE.Mesh => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = BLOCK_TEXTURE_SIZE;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "white";
      ctx.scale(BLOCK_TEXTURE_SIZE / 100, BLOCK_TEXTURE_SIZE / 100);
      draw(ctx);
      return new THREE.Mesh(geometry, [
        side,
        side,
        side,
        side,
        side,
        new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(canvas) }),
      ]);
    };
    return {
      arrow: createMesh((ctx) => {
        ctx.moveTo(10, 10);
        ctx.lineTo(90, 10);
        ctx.lineTo(50, 40);
        ctx.fill();
      }),
      dot: createMesh((ctx) => {
        ctx.arc(50, 50, 20, 0, 2 * Math.PI);
        ctx.fill();
      }),
    };
  };
  return {
    [LevelObjectType.BLOCK_LEFT]: createMeshes(
      blockColors[LevelObjectType.BLOCK_LEFT]
    ),
    [LevelObjectType.BLOCK_RIGHT]: createMeshes(
      blockColors[LevelObjectType.BLOCK_RIGHT]
    ),
  };
};
