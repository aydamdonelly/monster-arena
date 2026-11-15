'use dom';

import { useEffect } from 'react';
import * as THREE from 'three';

import { createMonsterScene } from '../lib/monster-scene';
import { updateMonster } from '../monster-kit/monster.js';

const SIZE = 328;

type Props = {
  items: { id: string; genome: Record<string, unknown> }[];
  onSnapshot: (id: string, uri: string) => Promise<void>;
  dom?: import('expo/dom').DOMProps;
};

export default function MonsterSnapshots({ items, onSnapshot }: Props) {
  const key = items.map((i) => i.id).join(',');

  useEffect(() => {
    if (!items.length) return;
    let cancelled = false;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE);
    (async () => {
      for (const item of items) {
        if (cancelled) return;
        try {
          const { scene, camera, monster, frame, dispose } = createMonsterScene(item.genome);
          frame(1);
          updateMonster(monster, 0.4);
          monster.rotation.y = -0.3;
          renderer.render(scene, camera);
          const uri = renderer.domElement.toDataURL('image/jpeg', 0.86);
          dispose();
          await onSnapshot(item.id, uri);
        } catch (e) {
          console.warn('snapshot failed', item.id, e);
        }
        await new Promise((r) => setTimeout(r, 0));
      }
    })();
    return () => {
      cancelled = true;
      renderer.dispose();
      renderer.forceContextLoss();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
