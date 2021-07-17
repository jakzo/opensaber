import * as THREE from "three";

interface Game {
  startGame(): void;
  stopGame(): void;
}

export const createGame = (container: HTMLElement): Game => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.append(renderer.domElement);

  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  camera.position.z = 5;

  let animationFrameHandle: number | undefined;
  const animate = (): void => {
    animationFrameHandle = requestAnimationFrame(animate);

    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;

    renderer.render(scene, camera);
  };

  return {
    startGame() {
      if (animationFrameHandle !== undefined) return;
      animate();
    },
    stopGame() {
      if (animationFrameHandle === undefined) return;
      cancelAnimationFrame(animationFrameHandle);
      animationFrameHandle = undefined;
    },
  };
};
