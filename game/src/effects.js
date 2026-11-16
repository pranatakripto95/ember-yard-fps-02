// Tracers, pooled so the hot loop allocates nothing. A tracer is a
// thin line from muzzle to hit point that fades away in 90 ms.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const POOL_SIZE = 24;
const TRACER_LIFE = 0.09;
export function createEffects(scene) {
  const tracers = [];
  for (let i = 0; i < POOL_SIZE; i += 1) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0 }));
    line.visible = false; line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  let next = 0;
  const tmp = new THREE.Vector3();
  // Impact sparks: a small pool of glowing shards that burst where a
  // shot lands, so a hit on a wall reads as well as a hit on a bot.
  const sparks = [];
  for (let i = 0; i < 10; i += 1) {
    const shard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.14, 0.14),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
    shard.visible = false; shard.frustumCulled = false;
    scene.add(shard);
    sparks.push({ mesh: shard, life: 0 });
  }
  let nextSpark = 0;
  function impact(point) {
    const s = sparks[nextSpark]; nextSpark = (nextSpark + 1) % sparks.length;
    s.mesh.position.copy(point);
    s.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    s.mesh.visible = true; s.mesh.material.opacity = 1; s.life = 0.22;
  }
  return {
    tracer(from, to) {
      const t = tracers[next]; next = (next + 1) % POOL_SIZE;
      const pos = t.line.geometry.attributes.position.array;
      pos[0] = from.x; pos[1] = from.y; pos[2] = from.z;
      pos[3] = to.x; pos[4] = to.y; pos[5] = to.z;
      t.line.geometry.attributes.position.needsUpdate = true;
      t.line.visible = true; t.line.material.opacity = 0.9; t.life = TRACER_LIFE;
    },
    step(dt) {
      for (const t of tracers) {
        if (t.life <= 0) continue;
        t.life -= dt;
        if (t.life <= 0) { t.line.visible = false; continue; }
        t.line.material.opacity = (t.life / TRACER_LIFE) * 0.9;
      }
      for (const s of sparks) {
        if (s.life <= 0) continue;
        s.life -= dt;
        if (s.life <= 0) { s.mesh.visible = false; continue; }
        s.mesh.material.opacity = s.life / 0.22;
        s.mesh.scale.setScalar(0.4 + (s.life / 0.22) * 0.8);
        s.mesh.rotation.z += dt * 9;
      }
    },
    impact,
    // Reused scratch vector for callers that need a muzzle position.
    muzzle(out, camera) { camera.getWorldPosition(tmp); out.copy(tmp); return out; },
  };
}
