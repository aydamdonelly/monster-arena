import * as THREE from 'three';

import { buildMonster } from '../monster-kit/monster.js';

export const STAGE_COLOR = '#e8f1ec';

export function createMonsterScene(genome: Record<string, unknown>) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(STAGE_COLOR);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight('#ffffff', '#cfdcd4', 1.5));
  const sun = new THREE.DirectionalLight('#ffffff', 2.0);
  sun.position.set(-3, 5, 4);
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#fff4ec', 0.9);
  fill.position.set(1.5, 1.5, 6);
  scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: STAGE_COLOR }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.001;
  scene.add(floor);

  const monster = buildMonster(genome);
  scene.add(monster);
  const height: number = monster.userData.monster?.height ?? 2;

  const frame = (aspect: number) => {
    camera.aspect = aspect;
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    const fitHeight = (height * 1.35) / (2 * tan);
    const fitWidth = 3 / (2 * tan * camera.aspect);
    camera.position.set(0, height * 0.75, Math.max(fitHeight, fitWidth));
    camera.lookAt(0, height * 0.48, 0);
    camera.updateProjectionMatrix();
  };

  const dispose = () => {
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      }
    });
  };

  return { scene, camera, monster, frame, dispose };
}
