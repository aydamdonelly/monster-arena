'use dom';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

import { updateMonster } from '../monster-kit/monster.js';
import { createMonsterScene } from '../lib/monster-scene';

const BURST = Array.from({ length: 28 }, (_, i) => {
  const r = i % 2 ? 62 : 92;
  const a = (i * Math.PI) / 14;
  return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r + 6).toFixed(1)}`;
}).join(' ');

type Props = {
  genome: Record<string, unknown>;
  burst?: boolean;
  dom?: import('expo/dom').DOMProps;
};

export default function MonsterView({ genome, burst }: Props) {
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
  }, [genomeKey, burst]);

  function mount(host: HTMLDivElement) {

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: burst });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.position = 'relative';
    host.appendChild(renderer.domElement);

    const { scene, camera, monster, frame, dispose } = createMonsterScene(JSON.parse(genomeKey));
    if (burst) {
      scene.background = null;
      scene.children.forEach((o) => o instanceof THREE.Mesh && (o.visible = false));
    }

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
        {burst ? (
          <svg viewBox="-100 -100 200 200" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <polygon points={BURST} fill="#FFFFFF" stroke="#111111" strokeWidth={2.5} strokeLinejoin="round" />
          </svg>
        ) : null}
        {error ? <p style={{ font: '12px sans-serif', padding: 8 }}>{error}</p> : null}
      </div>
    </>
  );
}
