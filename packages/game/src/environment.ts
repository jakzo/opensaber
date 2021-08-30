import * as THREE from "three";

export const createEnvironment = (): THREE.Group => {
  const environment = new THREE.Group();

  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 1000),
    new THREE.MeshLambertMaterial({ color: 0x333333 })
  );
  runway.position.set(0, 0, -505);
  runway.setRotationFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI * -0.5);
  environment.add(runway);

  const platform = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.MeshLambertMaterial({ color: 0x333333 })
  );
  platform.setRotationFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI * -0.5);
  environment.add(platform);

  return environment;
};
