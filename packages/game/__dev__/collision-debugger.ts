import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GUI } from "three/examples/jsm/libs/dat.gui.module.js";

import { createBlockMeshes } from "../src/block";
import { FiniteLine, PositionRotation } from "../src/collision";
import { createSaberMeshes } from "../src/saber";

const BLOCK_WIDTH = 0.5;
const SABER_LENGTH = 1.5;
const HANDLE_LENGTH = 0.2;

enum Fixtures {
  HIT,
  MISS,
  MISS_IN_LINE,
  REAL_WORLD_ERROR,
}

export const startCollisionDebugger = (container: HTMLElement): void => {
  const scene = new THREE.Scene();

  const camera = new THREE.OrthographicCamera(1, 1, 1, 1, 0.1, 1000);

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
    const frustum = 3;
    const aspect = container.clientWidth / container.clientHeight;
    camera.left = (frustum * aspect) / -2;
    camera.right = (frustum * aspect) / 2;
    camera.top = frustum / 2;
    camera.bottom = frustum / -2;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  setSize();
  new ResizeObserver(setSize).observe(container);
  container.append(renderer.domElement);

  const grid = new THREE.Group();
  scene.add(grid);
  const createLine = (
    color: number,
    axis: number,
    pos: [number, number, number]
  ): void => {
    grid.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3().fromArray(pos),
          new THREE.Vector3().fromArray(
            pos.map((coord, i) => (i === axis ? -coord : coord))
          ),
        ]),
        new THREE.LineBasicMaterial({ color })
      )
    );
  };
  createLine(0xff0000, 0, [10000, 0, 0]);
  createLine(0x00ff00, 2, [0, 0, 10000]);
  for (let i = -1.2; i <= 1.2; i += 0.2) {
    if (Math.abs(i) < 0.1) continue;
    createLine(0xffffff, 0, [1.2, 0, i]);
    createLine(0xffffff, 2, [i, 0, 1.2]);
  }

  const block = createBlockMeshes({ width: BLOCK_WIDTH }).BLOCK_LEFT.arrow;
  scene.add(block);

  const { BLOCK_LEFT: saberPrevFrame, BLOCK_RIGHT: saber } = createSaberMeshes({
    saberLength: SABER_LENGTH,
    handleLength: HANDLE_LENGTH,
  });
  scene.add(saberPrevFrame, saber);

  const orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.target.copy(block.position);
  orbitControls.update();

  let animFrame: undefined | number;
  const render = (): void => {
    renderer.render(scene, camera);
    animFrame = undefined;
  };
  const scheduleRender = (): void => {
    if (animFrame) return;
    animFrame = requestAnimationFrame(render);
  };
  document.addEventListener("mousedown", () => {
    document.addEventListener("mousemove", scheduleRender);
  });
  document.addEventListener("mouseup", () => {
    document.removeEventListener("mousemove", scheduleRender);
  });
  document.addEventListener("wheel", scheduleRender);

  const params = { updateCamera: true };
  /* eslint-disable @typescript-eslint/no-unsafe-call */
  const gui = new GUI() as any;
  gui.add(params, "updateCamera").name("Update camera");
  /* eslint-enable @typescript-eslint/no-unsafe-call */

  const parentObj = new THREE.Group();
  scene.add(parentObj);
  const steps = getCollisionDetectionSteps(
    block,
    saberPrevFrame,
    saber,
    new THREE.Box3(
      new THREE.Vector3(-BLOCK_WIDTH / 2, -BLOCK_WIDTH / 2, -BLOCK_WIDTH / 2),
      new THREE.Vector3(BLOCK_WIDTH / 2, BLOCK_WIDTH / 2, BLOCK_WIDTH / 2)
    ),
    Fixtures.REAL_WORLD_ERROR
  );
  const doStep = (idx: number): void => {
    steps[idx](
      parentObj,
      params.updateCamera ? camera : undefined,
      params.updateCamera ? orbitControls : undefined
    );
    scheduleRender();
  };
  let stepIdx = 0;
  doStep(stepIdx);
  document.addEventListener("keydown", (evt) => {
    if (evt.key === "ArrowRight" && stepIdx < steps.length - 1) {
      doStep(++stepIdx);
    }
    if (evt.key === "ArrowLeft" && stepIdx > 0) {
      doStep(--stepIdx);
    }
  });
};

/** More readable version of the collision detection algorithm (the one in the
 * source is optimized for speed) along with hooks to view intermittent state. */
// TODO: Is there a simple and fast algorithm to replace the lines with curves
//       that match saber rotation? (more accurate)
// TODO: Maybe I should just simplify this into standard plane-box collision
//       detection with angle and speed used to calculate cut
const getCollisionDetectionSteps = (
  blockObj: THREE.Object3D,
  saberPrevFrameObj: THREE.Object3D,
  saberObj: THREE.Object3D,
  blockHitbox: THREE.Box3,
  fixture: Fixtures
): ((
  parentObj: THREE.Object3D,
  camera?: THREE.Camera,
  orbitControls?: OrbitControls
) => void)[] => {
  const scene = new THREE.Group();
  const camera = new THREE.Camera();
  const orbitControls = new OrbitControls(
    camera,
    document.createElement("div")
  );
  const steps: {
    objs: Map<
      THREE.Object3D,
      { position: THREE.Vector3; quaternion: THREE.Quaternion }
    >;
    camera: THREE.Vector3;
    target: THREE.Vector3;
  }[] = [];
  const addStep = (step: () => void): void => {
    step();
    steps.push({
      objs: new Map(
        scene.children.map((obj) => [
          obj,
          {
            position: obj.position.clone(),
            quaternion: obj.quaternion.clone(),
          },
        ])
      ),
      camera: camera.position.clone(),
      target: orbitControls.target.clone(),
    });
  };

  // Initial placement of block and saber positions
  switch (fixture) {
    case Fixtures.HIT:
      blockObj.position.set(-0.2, 0, -1);
      blockObj.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI / 8);
      blockObj.rotateOnAxis(new THREE.Vector3(0, 0, 1), Math.PI / -16);
      saberPrevFrameObj.position.set(0.4, 0.2, 0.6);
      saberPrevFrameObj.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 8);
      saberPrevFrameObj.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI / 8);
      saberObj.position.set(0.1, -0.2, 0);
      saberObj.rotateOnAxis(new THREE.Vector3(1, 0, 0), -Math.PI / 8);
      saberObj.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI / 8);
      break;

    case Fixtures.MISS:
      blockObj.position.set(0, 0, 0);
      saberPrevFrameObj.position.set(0, 0.2, 2);
      saberPrevFrameObj.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 8);
      saberPrevFrameObj.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI / 8);
      saberObj.position.set(0, -0.2, 2);
      saberObj.rotateOnAxis(new THREE.Vector3(1, 0, 0), -Math.PI / 8);
      saberObj.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI / 8);
      break;

    case Fixtures.MISS_IN_LINE:
      blockObj.position.set(0, 0, 0);
      saberPrevFrameObj.position.set(0, 0.2, 2);
      saberPrevFrameObj.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 8);
      // saberPrevFrameObj.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI / 16);
      saberObj.position.set(0, -0.2, 2);
      saberObj.rotateOnAxis(new THREE.Vector3(1, 0, 0), -Math.PI / 8);
      // saberObj.rotateOnAxis(new THREE.Vector3(0, 1, 0), -Math.PI / 16);
      break;

    case Fixtures.REAL_WORLD_ERROR:
      blockObj.position.set(-0.3, 0.8, -3.207225714285716);
      saberPrevFrameObj.position.set(
        -0.2791900038719177,
        1.2628830671310425,
        -0.2402738481760025
      );
      saberPrevFrameObj.quaternion.set(
        0.3833432710450465,
        -0.01917380712517816,
        0.2899262453881679,
        0.8767115112167344
      );
      saberObj.position.set(
        -0.3001972436904907,
        1.3072444200515747,
        -0.20761895745945003
      );
      saberObj.quaternion.set(
        0.6345483542739245,
        -0.02692410806114394,
        0.2758416076037299,
        0.7214810364853365
      );
      break;
  }

  const block: PositionRotation = {
    position: blockObj.position.clone(),
    quaternion: blockObj.quaternion.clone(),
  };
  const saberPrevFrame: PositionRotation = {
    position: saberPrevFrameObj.position.clone(),
    quaternion: saberPrevFrameObj.quaternion.clone(),
  };
  const saber: PositionRotation = {
    position: saberObj.position.clone(),
    quaternion: saberObj.quaternion.clone(),
  };

  addStep(() => {
    scene.add(blockObj, saberPrevFrameObj, saberObj);
    blockObj.position.copy(block.position);
    blockObj.quaternion.copy(block.quaternion);
    saberPrevFrameObj.position.copy(saberPrevFrame.position);
    saberPrevFrameObj.quaternion.copy(saberPrevFrame.quaternion);
    saberObj.position.copy(saber.position);
    saberObj.quaternion.copy(saber.quaternion);
    camera.position.set(-1.2, 1.2, 1.2);
    orbitControls.target.copy(blockObj.position);
  });

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
    position: saber.position
      .clone()
      .sub(block.position)
      .applyQuaternion(blockRotInverse),
    quaternion: new THREE.Quaternion().multiplyQuaternions(
      blockRotInverse,
      saber.quaternion
    ),
  };

  addStep(() => {
    blockObj.position.set(0, 0, 0);
    blockObj.quaternion.identity();
    saberPrevFrameObj.position.copy(relSaberPrevFrame.position);
    saberPrevFrameObj.quaternion.copy(relSaberPrevFrame.quaternion);
    saberObj.position.copy(relSaber.position);
    saberObj.quaternion.copy(relSaber.quaternion);
    camera.position.sub(block.position).applyQuaternion(blockRotInverse);
    orbitControls.target.copy(blockObj.position);
  });

  // Calculate lines going from the saberPrevFrame to saber at the start and end
  const pointAlongLine = (
    { position, quaternion }: PositionRotation,
    dist: number
  ): THREE.Vector3 =>
    new THREE.Vector3(0, 0, -dist).applyQuaternion(quaternion).add(position);
  const lineStart: FiniteLine = [
    pointAlongLine(relSaberPrevFrame, HANDLE_LENGTH / 2),
    pointAlongLine(relSaber, HANDLE_LENGTH / 2),
  ];
  const lineEnd: FiniteLine = [
    pointAlongLine(relSaberPrevFrame, SABER_LENGTH),
    pointAlongLine(relSaber, SABER_LENGTH),
  ];

  addStep(() => {
    scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(lineStart),
        new THREE.LineBasicMaterial({ color: 0xff00ff })
      ),
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(lineEnd),
        new THREE.LineBasicMaterial({ color: 0xff00ff })
      )
    );
  });

  // Calculate line between saberPrevFrame-saber lines at block top height
  const intersectAtY = (line: FiniteLine, y: number): THREE.Vector3 => {
    // Calculations here based on simple 2D line formulas.
    // These were derived by viewing the 3D lines between the sabers from
    // orthogonal views (eg. birds-eye and side-on) where they appear as 2D
    // lines.

    // For a 2D line with X and Y coordinates:
    // y = gradient * x + offset
    // x = (y - offset) / gradient

    // Looking ahead at lines so in 2D X would be X and Y would be Y (Z is ignored)
    // TODO: If gradient is 0 in either of these calculations, there is no Y
    //       intercept so we shouldn't continue
    const gradientX = (line[1].y - line[0].y) / (line[1].x - line[0].x);
    const offsetX = line[1].y - line[1].x * gradientX;
    const xAtY =
      line[1].x === line[0].x || gradientX === 0
        ? line[0].x
        : (y - offsetX) / gradientX;
    // Looking side-on at lines from the left so in 2D Z would be X and Y would be Y
    const gradientY = (line[1].y - line[0].y) / (line[1].z - line[0].z);
    const offsetY = line[1].y - line[1].z * gradientY;
    const zAtY =
      line[1].z === line[0].z || gradientY === 0
        ? line[0].z
        : (y - offsetY) / gradientY;
    return new THREE.Vector3(xAtY, y, zAtY);
  };
  const lineBlockTop = [
    intersectAtY(lineStart, blockHitbox.max.y),
    intersectAtY(lineEnd, blockHitbox.max.y),
  ];

  addStep(() => {
    scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(lineBlockTop),
        new THREE.LineBasicMaterial({ color: 0x0000ff })
      )
    );
  });

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

  addStep(() => {
    camera.position.set(0, -1.5, 0);
    if (Math.abs(zAtBlockLeft) < 1e9)
      scene.add(
        new THREE.Points(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(
              blockHitbox.min.x,
              blockHitbox.max.y,
              zAtBlockLeft
            ),
          ]),
          new THREE.PointsMaterial({
            size: 10,
            color:
              zAtBlockLeft >= blockHitbox.min.z &&
              zAtBlockLeft <= blockHitbox.max.z
                ? 0x00ffff
                : 0xffffff,
          })
        )
      );
    if (Math.abs(zAtBlockRight) < 1e9)
      scene.add(
        new THREE.Points(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(
              blockHitbox.max.x,
              blockHitbox.max.y,
              zAtBlockRight
            ),
          ]),
          new THREE.PointsMaterial({
            size: 10,
            color:
              zAtBlockRight >= -blockHitbox.min.z &&
              zAtBlockRight <= blockHitbox.max.z
                ? 0x00ffff
                : 0xffffff,
          })
        )
      );
    if (Math.abs(xAtBlockFront) < 1e9)
      scene.add(
        new THREE.Points(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(
              xAtBlockFront,
              blockHitbox.max.y,
              blockHitbox.max.z
            ),
          ]),
          new THREE.PointsMaterial({
            size: 10,
            color:
              xAtBlockFront >= blockHitbox.min.x &&
              xAtBlockFront <= blockHitbox.max.x
                ? 0x00ffff
                : 0xffffff,
          })
        )
      );
    if (Math.abs(xAtBlockBack) < 1e9)
      scene.add(
        new THREE.Points(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(
              xAtBlockBack,
              blockHitbox.max.y,
              blockHitbox.min.z
            ),
          ]),
          new THREE.PointsMaterial({
            size: 10,
            color:
              xAtBlockBack >= blockHitbox.min.x &&
              xAtBlockBack <= blockHitbox.max.x
                ? 0x00ffff
                : 0xffffff,
          })
        )
      );
  });

  // TODO: Limit line to saber cut plane
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
  console.log({ isIntersectWithinFaceAndLine });

  return steps.map((step) => (parentObj, camera, orbitControls) => {
    parentObj.remove(...parentObj.children);
    for (const [obj, { position, quaternion }] of step.objs.entries()) {
      obj.position.copy(position);
      obj.quaternion.copy(quaternion);
      parentObj.add(obj);
    }
    if (camera) camera.position.copy(step.camera);
    if (orbitControls) {
      orbitControls.target.copy(step.target);
      orbitControls.update();
    }
  });
};
