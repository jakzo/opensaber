import * as THREE from "three";

import { SaberOpts } from "./saber";

export type PositionRotation = Pick<THREE.Object3D, "position" | "quaternion">;

export type FiniteLine = [THREE.Vector3, THREE.Vector3];
export interface LineData {
  line: FiniteLine;
  gradientX: number;
  offsetX: number;
  gradientY: number;
  offsetY: number;
}

export interface CutResult {
  /** Number between 0 and 1 where 0 is a complete miss of the block and 1 is a
   * cut into two exactly equal sized pieces. */
  accuracy: number;
  /** Speed in m/s the saber hit the block at. */
  speed: number;
  /** The "strength" of the cut. Since there's no way to actually find the
   * strength the player put into moving the controller, the speed of the
   * controller and distance recently travelled in the current direction is
   * used as an approximation. This causes cuts made using arms instead of
   * wrists to have higher strength. */
  strength: number;
  /** Number between -1 and 1 where 0 is the exact angle the block should be
   * cut at. Positive values rotate the angle clockwise, negative opposite. */
  angle: number;
  /** Geometry of both halves of the block after cutting it. */
  blockHalves: [THREE.BufferGeometry, THREE.BufferGeometry];
}

export const calculateCut = (
  block: PositionRotation,
  saberPrevFrame: PositionRotation,
  saber: PositionRotation,
  saberOpts: SaberOpts,
  blockHitbox: THREE.Box3
): CutResult | undefined => {
  // See collision-debugger.ts for a more detailed version of this algorithm
  // Reset block position/rotation to 0 and make saber positions relative to this
  const blockRotInverse = block.quaternion.clone().conjugate();
  const relSaberPrevFrame: PositionRotation = {
    position: saberPrevFrame.position
      .clone()
      .sub(block.position)
      .applyQuaternion(blockRotInverse),
    quaternion: new THREE.Quaternion().multiplyQuaternions(
      blockRotInverse,
      saberPrevFrame.quaternion
    ),
  };
  const relSaber: PositionRotation = {
    position: new THREE.Vector3()
      .copy(saber.position)
      .sub(block.position)
      .applyQuaternion(blockRotInverse),
    quaternion: new THREE.Quaternion().multiplyQuaternions(
      blockRotInverse,
      saber.quaternion
    ),
  };

  // Calculate lines going from saberPrevFrame to saber at the start and end
  const pointAlongLine = (
    { position, quaternion }: PositionRotation,
    dist: number
  ): THREE.Vector3 =>
    new THREE.Vector3(0, 0, -dist).applyQuaternion(quaternion).add(position);
  const lineStart: FiniteLine = [
    pointAlongLine(relSaberPrevFrame, saberOpts.handleLength / 2),
    pointAlongLine(relSaber, saberOpts.handleLength / 2),
  ];
  const lineEnd: FiniteLine = [
    pointAlongLine(relSaberPrevFrame, saberOpts.saberLength),
    pointAlongLine(relSaber, saberOpts.saberLength),
  ];

  // Calculate cut lines along block faces
  const [lineStartData, lineEndData] = [lineStart, lineEnd].map(
    (line): LineData => {
      const [a, b] = line;
      const gradientX = (b.y - a.y) / (b.x - a.x);
      const offsetX = b.y - b.x * gradientX;
      const gradientY = (b.y - a.y) / (b.z - a.z);
      const offsetY = b.y - b.z * gradientY;
      return { line, gradientX, offsetX, gradientY, offsetY };
    }
  );

  // Calculate line between saberPrevFrame-saber lines at: y = block top
  const intersectAtY = (line: LineData, y: number): THREE.Vector3 => {
    const xAtY =
      line.line[1].x === line.line[0].x || line.gradientX === 0
        ? line.line[0].x
        : (y - line.offsetX) / line.gradientX;
    const zAtY =
      line.line[1].z === line.line[0].z || line.gradientY === 0
        ? line.line[0].z
        : (y - line.offsetY) / line.gradientY;
    return new THREE.Vector3(xAtY, y, zAtY);
  };
  const lineBlockTop: FiniteLine = [
    intersectAtY(lineStartData, blockHitbox.max.y),
    intersectAtY(lineEndData, blockHitbox.max.y),
  ];

  // Find intersects of the slice line with the block's top face edges
  const gradientX =
    (lineBlockTop[1].z - lineBlockTop[0].z) /
    (lineBlockTop[1].x - lineBlockTop[0].x);
  const offsetX = lineBlockTop[1].z - lineBlockTop[1].x * gradientX;
  const zAtBlockLeft =
    lineBlockTop[1].z === lineBlockTop[0].z
      ? lineBlockTop[0].z
      : gradientX * blockHitbox.min.x + offsetX;
  const zAtBlockRight =
    lineBlockTop[1].z === lineBlockTop[0].z
      ? lineBlockTop[0].z
      : gradientX * blockHitbox.max.x + offsetX;
  const xAtBlockFront =
    lineBlockTop[1].x === lineBlockTop[0].x
      ? lineBlockTop[0].x
      : (blockHitbox.max.z - offsetX) / gradientX;
  const xAtBlockBack =
    lineBlockTop[1].x === lineBlockTop[0].x
      ? lineBlockTop[0].x
      : (blockHitbox.min.z - offsetX) / gradientX;

  const isIntersectWithinFaceAndLine =
    (zAtBlockLeft >= blockHitbox.min.z &&
      zAtBlockLeft <= blockHitbox.max.z &&
      blockHitbox.min.x > lineBlockTop[0].x ===
        blockHitbox.min.x < lineBlockTop[1].x) ||
    (zAtBlockRight >= blockHitbox.min.z &&
      zAtBlockRight <= blockHitbox.max.z &&
      blockHitbox.max.x > lineBlockTop[0].x ===
        blockHitbox.max.x < lineBlockTop[1].x) ||
    (xAtBlockFront >= blockHitbox.min.x &&
      xAtBlockFront <= blockHitbox.max.x &&
      blockHitbox.max.z > lineBlockTop[0].z ===
        blockHitbox.max.z < lineBlockTop[1].z) ||
    (xAtBlockBack >= blockHitbox.min.x &&
      xAtBlockBack <= blockHitbox.max.x &&
      blockHitbox.min.z > lineBlockTop[0].z ===
        blockHitbox.min.z < lineBlockTop[1].z);
  if (!isIntersectWithinFaceAndLine) return undefined;

  // TODO
  return {
    accuracy: 1,
    speed: 1,
    strength: 1,
    angle: 0,
    blockHalves: [new THREE.BufferGeometry(), new THREE.BufferGeometry()],
  };
};
