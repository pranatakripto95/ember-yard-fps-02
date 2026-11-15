// One smoke grenade: thrown on an arc, pops on landing, and blocks bot
// sight (and the player's) for 8 s. A translucent ember sphere marks the
// cloud, and the segment test below is what bots call through hasLOS.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const GRAVITY = 12;
const SMOKE_SECONDS = 8;
const SMOKE_RADIUS = 3.2;
export function createGrenades(scene) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(SMOKE_RADIUS, 20, 14),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.muted), transparent: true, opacity: 0.32, depthWrite: false }),
  );
  mesh.visible = false; scene.add(mesh);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent) }));
  ball.visible = false; scene.add(ball);
  const state = { flying: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), smokeAt: new THREE.Vector3(), smokeLeft: 0 };
  return {
    state,
    throwFrom(origin, dir) {
      if (state.flying || state.smokeLeft > 0) return false;
      state.flying = true;
      state.pos.copy(origin);
      state.vel.copy(dir).multiplyScalar(11); state.vel.y += 3.5;
      ball.visible = true; ball.position.copy(state.pos);
      return true;
    },
    step(dt) {
      if (state.flying) {
        state.vel.y -= GRAVITY * dt;
        state.pos.addScaledVector(state.vel, dt);
        ball.position.copy(state.pos);
        if (state.pos.y <= 0.1) {
          state.flying = false; ball.visible = false;
          state.smokeAt.copy(state.pos); state.smokeAt.y = 1.2;
          state.smokeLeft = SMOKE_SECONDS;
          mesh.position.copy(state.smokeAt); mesh.visible = true;
        }
      }
      if (state.smokeLeft > 0) {
        state.smokeLeft -= dt;
        mesh.material.opacity = 0.32 * Math.min(1, state.smokeLeft / 2);
        if (state.smokeLeft <= 0) mesh.visible = false;
      }
    },
    // True when the segment a->b passes through the smoke cloud.
    blocks(a, b) {
      if (state.smokeLeft <= 0) return false;
      const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
      const len2 = abx * abx + aby * aby + abz * abz || 1;
      let t = ((state.smokeAt.x - a.x) * abx + (state.smokeAt.y - a.y) * aby + (state.smokeAt.z - a.z) * abz) / len2;
      t = Math.max(0, Math.min(1, t));
      const dx = a.x + abx * t - state.smokeAt.x;
      const dy = a.y + aby * t - state.smokeAt.y;
      const dz = a.z + abz * t - state.smokeAt.z;
      return dx * dx + dy * dy + dz * dz < SMOKE_RADIUS * SMOKE_RADIUS;
    },
    reset() { state.flying = false; state.smokeLeft = 0; mesh.visible = false; ball.visible = false; },
  };
}
