import * as THREE from "three";

export const createStage = (): THREE.Group => {
  const stage = new THREE.Group();

  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 1000),
    new THREE.MeshLambertMaterial({ color: 0x333333 })
  );
  runway.position.set(0, 0, 505);
  runway.setRotationFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI * -0.5);
  stage.add(runway);

  const platform = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.MeshLambertMaterial({ color: 0x333333 })
  );
  platform.setRotationFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI * -0.5);
  stage.add(platform);

  return stage;
};
