// Tracers, pooled so the hot loop allocates nothing. A tracer is a thin
// line from muzzle to hit point that fades in 90 ms.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const POOL = 24;
const LIFE = 0.09;
export function createEffects(scene) {
  const tracers = [];
  for (let i = 0; i < POOL; i += 1) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0 }));
    line.visible = false; line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  let next = 0;
  const tmp = new THREE.Vector3();
  return {
    tracer(from, to) {
      const t = tracers[next]; next = (next + 1) % POOL;
      const pos = t.line.geometry.attributes.position.array;
      pos[0] = from.x; pos[1] = from.y; pos[2] = from.z;
      pos[3] = to.x; pos[4] = to.y; pos[5] = to.z;
      t.line.geometry.attributes.position.needsUpdate = true;
      t.line.visible = true; t.line.material.opacity = 0.9; t.life = LIFE;
    },
    step(dt) {
      for (const t of tracers) {
        if (t.life <= 0) continue;
        t.life -= dt;
        if (t.life <= 0) { t.line.visible = false; continue; }
        t.line.material.opacity = (t.life / LIFE) * 0.9;
      }
    },
    // Reused scratch vector for callers that need a muzzle position.
    muzzle(out, camera) { camera.getWorldPosition(tmp); out.copy(tmp); return out; },
  };
}
