'use dom';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

import { buildMonster, updateMonster } from '../monster-kit/monster.js';

type Props = {
  genome: Record<string, unknown>;
  dom?: import('expo/dom').DOMProps;
};

export default function MonsterView({ genome }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const genomeKey = JSON.stringify(genome);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    try {
      return mount(host);
    } catch (e) {
      setError(String(e));
    }
  }, [genomeKey]);

  function mount(host: HTMLDivElement) {

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e8f1ec');
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    scene.add(new THREE.HemisphereLight('#ffffff', '#cfdcd4', 1.5));
    const sun = new THREE.DirectionalLight('#ffffff', 2.0);
    sun.position.set(-3, 5, 4);
    scene.add(sun);
    const fill = new THREE.DirectionalLight('#fff4ec', 0.9);
    fill.position.set(1.5, 1.5, 6);
    scene.add(fill);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: '#e8f1ec' }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.001;
    scene.add(floor);

    const monster = buildMonster(JSON.parse(genomeKey));
    scene.add(monster);
    const height: number = monster.userData.monster?.height ?? 2;

    const resize = () => {
      const w = host.clientWidth || window.innerWidth || 1;
      const h = host.clientHeight || window.innerHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      const tan = Math.tan((camera.fov * Math.PI) / 360);
      const fitHeight = (height * 1.35) / (2 * tan);
      const fitWidth = 3 / (2 * tan * camera.aspect);
      camera.position.set(0, height * 0.75, Math.max(fitHeight, fitWidth));
      camera.lookAt(0, height * 0.48, 0);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const t = clock.getElapsedTime();
      updateMonster(monster, t);
      monster.rotation.y = Math.sin(t * 0.6) * 0.35;
      renderer.render(scene, camera);
    });

    return () => {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }

  return (
    <>
      <style>{'html, body, #root, body > div { margin: 0; height: 100%; background: #e8f1ec; overflow: hidden; }'}</style>
      <div ref={ref} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 120 }}>
        {error ? <p style={{ font: '12px sans-serif', padding: 8 }}>{error}</p> : null}
      </div>
    </>
  );
}
