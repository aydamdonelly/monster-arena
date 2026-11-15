'use dom';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

import { updateMonster } from '../monster-kit/monster.js';
import { createMonsterScene } from '../lib/monster-scene';

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

    const { scene, camera, monster, frame, dispose } = createMonsterScene(JSON.parse(genomeKey));

    const resize = () => {
      const w = host.clientWidth || window.innerWidth || 1;
      const h = host.clientHeight || window.innerHeight || 1;
      renderer.setSize(w, h);
      frame(w / h);
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
      dispose();
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
