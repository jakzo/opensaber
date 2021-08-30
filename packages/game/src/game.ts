import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Stats from "three/examples/jsm/libs/stats.module";
import { VRButton } from "three/examples/jsm/webxr/VRButton";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory";

import { LevelStateOpts } from "./LevelState";
import { PlayLevel } from "./PlayLevel";
import { Playable } from "./Playable";
import { Replay, ReplayOpts } from "./Replay";
import { createEnvironment } from "./environment";

export interface GameOpts {
  container: HTMLElement;
  showStats?: boolean;
}

export class Game {
  stats: Stats | undefined;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  playable?: Playable;
  timePrev: number | undefined;
  controllers: THREE.Group[];

  fakeHeadset = new THREE.Object3D();
  isStopped = true;

  constructor(opts: GameOpts) {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    this.camera.position.set(0, 1.6, 1);
    this.camera.lookAt(0, 0, -1000);

    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.4);
    this.scene.add(ambientLight);

    for (const [x, y, z] of [
      [2, 2, 0],
      [-2, 2, 0],
    ]) {
      const light = new THREE.DirectionalLight(0xffffff, 0.4);
      light.position.set(x, y, z);
      this.scene.add(light);
    }

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.xr.enabled = true;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    const setSize = (): void => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(
        opts.container.clientWidth,
        opts.container.clientHeight
      );
    };
    setSize();
    new ResizeObserver(setSize).observe(opts.container);
    opts.container.append(this.renderer.domElement);
    opts.container.appendChild(VRButton.createButton(this.renderer));

    const controllerModelFactory = new XRControllerModelFactory();
    for (const i of [0, 1]) {
      const controller = this.renderer.xr.getControllerGrip(i);
      controller.add(controllerModelFactory.createControllerModel(controller));
      this.scene.add(controller);
    }

    this.stats = opts.showStats ? Stats() : undefined;
    if (this.stats) opts.container.appendChild(this.stats.dom);

    const environment = createEnvironment();
    this.scene.add(environment);

    const orbitControls = new OrbitControls(
      this.camera,
      this.renderer.domElement
    );
    orbitControls.target = new THREE.Vector3(0, 1, -10);
    orbitControls.update();

    this.controllers = [0, 1].map((i) => {
      const controller = this.renderer.xr.getControllerGrip(i);
      controller.addEventListener("connected", () => {
        this.scene.add(controller);
      });
      controller.addEventListener("disconnected", () => {
        this.scene.remove(controller);
      });
      return controller;
    });
  }

  protected animate = (time: number): void => {
    this.stats?.begin();

    if (this.timePrev === undefined) this.timePrev = time;

    if (this.playable) {
      const timeDelta = (time - this.timePrev) / 1000;
      this.playable.animate(timeDelta, {
        headset: !this.renderer.xr.isPresenting
          ? this.fakeHeadset
          : this.camera,
        controllers: this.controllers,
      });
    }

    this.renderer.render(this.scene, this.camera);

    this.timePrev = time;
    this.stats?.end();
  };

  startGame(): Game {
    this.renderer.setAnimationLoop(this.animate);
    if (this.playable) this.playable.setStopped(false);
    this.timePrev = undefined;
    this.isStopped = false;
    return this;
  }

  stopGame(): Game {
    this.renderer.setAnimationLoop(null);
    if (this.playable) this.playable.setStopped(true);
    this.timePrev = undefined;
    this.isStopped = true;
    return this;
  }

  async playLevel(
    opts: LevelStateOpts
  ): Promise<{ createRecording: PlayLevel["createRecording"] }> {
    const playLevel = new PlayLevel({
      levelState: opts,
      controllers: this.controllers,
    });
    this.scene.add(playLevel.obj);
    this.playable = playLevel;
    await playLevel.levelState.promise;
    return { createRecording: playLevel.createRecording.bind(playLevel) };
  }

  async playbackRecording(
    opts: Omit<ReplayOpts, "headset"> & { headsetPerspective?: boolean }
  ): Promise<void> {
    const replay = new Replay({
      ...opts,
      headset: opts.headsetPerspective ? this.camera : undefined,
    });
    this.scene.add(replay.obj);
    this.playable = replay;
    await replay.levelState.promise;
  }
}
