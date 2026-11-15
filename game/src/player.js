// Player movement and health: acceleration, friction, gravity and
// crouch, resolved as a box against the world's colliders one axis at a
// time, so a wall never swallows the player. There is no jump in Ember
// Yard — it keeps the sightlines and the round readable. Aiming with the
// right mouse slows movement; crouching slows it more.
import * as THREE from 'three';

const BODY_RADIUS = 0.34;
const TALL_HEIGHT = 1.72;
const LOW_HEIGHT = 1.12;
const TALL_EYE = 1.6;
const LOW_EYE = 1.02;
const RUN_SPEED = 5.2;
const CROUCH_SPEED = 2.4;
const AIM_SPEED = 2.9;
const ACCEL = 42;
const DRAG = 9;
const GRAVITY = 20;

export function createPlayer(colliders, spawn) {
  const player = {
    position: new THREE.Vector3(spawn?.x ?? 0, 0, spawn?.z ?? 11),
    velocity: new THREE.Vector3(),
    yaw: 0, pitch: 0, eye: TALL_EYE, onGround: true,
    crouching: false, aiming: false, height: TALL_HEIGHT,
    health: 100, maxHealth: 100, armor: 0, alive: true,
  };
  const box = new THREE.Box3();
  const move = new THREE.Vector3();
  function hits(x, y, z, height, lift) {
    box.min.set(x - BODY_RADIUS, y + lift, z - BODY_RADIUS);
    box.max.set(x + BODY_RADIUS, y + height - lift, z + BODY_RADIUS);
    for (const collider of colliders) if (box.intersectsBox(collider)) return collider;
    return null;
  }
  function look(dx, dy, sensitivity = 0.0022) {
    player.yaw -= dx * sensitivity;
    player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - dy * sensitivity));
  }
  function recoil(pitchKick, yawKick) {
    player.pitch = Math.min(1.45, player.pitch + pitchKick);
    player.yaw += yawKick;
  }
  function damage(amount) {
    if (!player.alive) return false;
    let rest = amount;
    if (player.armor > 0) {
      const absorbed = Math.min(player.armor, rest * 0.5);
      player.armor -= absorbed; rest -= absorbed;
    }
    player.health -= rest;
    if (player.health <= 0) { player.health = 0; player.alive = false; return true; }
    return false;
  }
  function reset(spawnPos, yaw) {
    player.position.set(spawnPos.x, 0, spawnPos.z);
    player.velocity.set(0, 0, 0);
    player.yaw = yaw ?? 0; // yaw 0 faces north (-z) from the south spawn
    player.pitch = 0; player.health = player.maxHealth; player.armor = 0; player.alive = true;
  }
  function step(dt, keys) {
    if (!player.alive) return;
    const wantCrouch = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
    if (wantCrouch && !player.crouching) { player.crouching = true; player.height = LOW_HEIGHT; }
    else if (!wantCrouch && player.crouching && !hits(player.position.x, player.position.y, player.position.z, TALL_HEIGHT, 0.02)) {
      player.crouching = false; player.height = TALL_HEIGHT;
    }
    const eyeTarget = player.crouching ? LOW_EYE : TALL_EYE;
    player.eye += (eyeTarget - player.eye) * Math.min(1, dt * 12);
    const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    move.set(0, 0, 0);
    if (forward || strafe) {
      const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
      move.set(-sin * forward + cos * strafe, 0, -cos * forward - sin * strafe).normalize();
    }
    const speed = player.crouching ? CROUCH_SPEED : player.aiming ? AIM_SPEED : RUN_SPEED;
    const blend = Math.min(1, ACCEL * dt / speed);
    player.velocity.x += (move.x * speed - player.velocity.x) * blend;
    player.velocity.z += (move.z * speed - player.velocity.z) * blend;
    if (!move.lengthSq()) {
      const damp = Math.max(0, 1 - DRAG * dt);
      player.velocity.x *= damp; player.velocity.z *= damp;
    }
    player.velocity.y -= GRAVITY * dt;
    const nextX = player.position.x + player.velocity.x * dt;
    if (!hits(nextX, player.position.y, player.position.z, player.height, 0.04)) player.position.x = nextX;
    else player.velocity.x = 0;
    const nextZ = player.position.z + player.velocity.z * dt;
    if (!hits(player.position.x, player.position.y, nextZ, player.height, 0.04)) player.position.z = nextZ;
    else player.velocity.z = 0;
    player.position.y += player.velocity.y * dt;
    player.onGround = false;
    const floor = hits(player.position.x, player.position.y, player.position.z, player.height, 0);
    if (floor && player.velocity.y <= 0) { player.position.y = floor.max.y; player.velocity.y = 0; player.onGround = true; }
    else if (floor) { player.position.y = floor.min.y - player.height; player.velocity.y = 0; }
    if (player.position.y < 0) { player.position.y = 0; player.velocity.y = 0; player.onGround = true; }
    player.velocity.y = Math.max(-30, player.velocity.y);
  }
  return {
    state: player, step, look, recoil, damage, reset,
    groundSpeed() { return Math.hypot(player.velocity.x, player.velocity.z); },
  };
}
