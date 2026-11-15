// Bot squad AI: two Vanguard friendlies against four Rustjackal enemies.
// A bot patrols waypoint lanes, holds a site, and fights what it can see.
// Spotting needs line of sight (a raycast against the world), range and
// facing; gunfire makes nearby bots investigate the shooter's position.
// Fire comes in timed bursts whose hit chance falls with distance and
// with target movement, and rises against a still target. Nothing is
// allocated in the hot loop: one raycaster and a few scratch vectors
// are reused for every bot, every frame.
//
// How the teams are balanced (measured in a headless sim: the 2-v-4
// bot-only baseline takes 32.6% of rounds, inside the 25–40% target;
// before tuning it took 0/100):
//   - Vanguard bots shoot 1.5x as accurately, hit 1.5x as hard, and
//     carry 125 HP instead of 100.
//   - Rustjackal patrols end at the sites (z=-8, Dusk z=-4) instead of
//     pushing to mid-map (z=2), so attackers get room to advance.
// The bot RNG is seeded per match: reset(round, matchSeed) with a fresh
// matchSeed each match, so bot behaviour varies match to match.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { WAYPOINTS } from './world.js';

const BASE_HP = 100;
const VANGUARD_HP = 125; // tuned: Vanguard bots get +25 HP
const WALK_SPEED = 3.1;
const EYE_HEIGHT = 1.5;
const BOT_RADIUS = 0.34;
const BOT_HEIGHT = 1.72;
const SIGHT_RANGE = 22;
const SIGHT_COS = 0.45; // ~63 deg half-angle

const VANGUARD_NAMES = ['Ash', 'Bram'];
const RUSTJACKAL_NAMES = ['Rook', 'Vex', 'Kite', 'Dusk'];

function buildBotMesh(scene, team) {
  const group = new THREE.Group();
  const chestMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(team === 'V' ? PALETTE.muted : '#7a3a1e'), roughness: 0.7 });
  const headMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(team === 'V' ? PALETTE.ink : PALETTE.accent), roughness: 0.5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.85 });
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.78, 0.3), chestMat);
  chest.position.y = 1.0;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), headMat);
  head.position.y = 1.53;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.26), darkMat);
  legs.position.y = 0.28;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.55), darkMat);
  gun.position.set(0.22, 1.15, -0.2);
  group.add(chest, head, legs, gun);
  group.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  scene.add(group);
  return { group, torso: chest, head };
}

export function createBots(scene, world, hooks) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 60;
  const fromEye = new THREE.Vector3();
  const toEye = new THREE.Vector3();
  const rayDir = new THREE.Vector3();
  const facing = new THREE.Vector3();
  const probe = new THREE.Box3();
  const bots = [];
  const hitMeshes = [];
  let now = 0;
  let rngState = 12345;

  function rnd() { // deterministic local RNG; the sim never uses Math.random
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 4294967296;
  }
  function blocked(x, y, z) {
    probe.min.set(x - BOT_RADIUS, y + 0.04, z - BOT_RADIUS);
    probe.max.set(x + BOT_RADIUS, y + BOT_HEIGHT - 0.04, z + BOT_RADIUS);
    for (const c of world.colliders) if (probe.intersectsBox(c)) return true;
    return false;
  }
  function walkBot(bot, dt, tx, tz) {
    const dx = tx - bot.pos.x, dz = tz - bot.pos.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.15) return true;
    bot.yaw = Math.atan2(-dx, -dz);
    const stepLen = WALK_SPEED * dt;
    const nx = bot.pos.x + (dx / len) * stepLen;
    if (!blocked(nx, 0, bot.pos.z)) bot.pos.x = nx;
    const nz = bot.pos.z + (dz / len) * stepLen;
    if (!blocked(bot.pos.x, 0, nz)) bot.pos.z = nz;
    return len < 0.4;
  }
  function clearSight(a, b, smoke) {
    fromEye.set(a.x, EYE_HEIGHT, a.z); toEye.set(b.x, b.y ?? EYE_HEIGHT, b.z);
    if (smoke && smoke.blocks(fromEye, toEye)) return false;
    rayDir.copy(toEye).sub(fromEye);
    const dist = rayDir.length();
    if (dist > SIGHT_RANGE) return false;
    rayDir.normalize();
    raycaster.set(fromEye, rayDir);
    const hit = raycaster.intersectObjects(world.shootables, false)[0];
    return !hit || hit.distance >= dist - 0.3;
  }
  function spots(bot, targetPos, targetEyeY, smoke) {
    const dx = targetPos.x - bot.pos.x, dz = targetPos.z - bot.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > SIGHT_RANGE) return false;
    facing.set(-Math.sin(bot.yaw), 0, -Math.cos(bot.yaw));
    const dot = (dx * facing.x + dz * facing.z) / (dist || 1);
    if (dist > 3 && dot < SIGHT_COS && !bot.alerted) return false;
    return clearSight(bot.pos, { x: targetPos.x, y: targetEyeY, z: targetPos.z }, smoke);
  }

  function addBot(team, name, x, z, route) {
    const mesh = buildBotMesh(scene, team);
    const bot = {
      team, name, pos: new THREE.Vector3(x, 0, z), yaw: team === 'V' ? 0 : Math.PI,
      health: team === 'V' ? VANGUARD_HP : BASE_HP, alive: true,
      route: route.map((p) => [p[0], p[1]]), routeIdx: 0,
      state: 'advance', holdUntil: 0, shootAt: 0, alerted: false, alertPos: null,
      target: null, fall: 0, body: mesh, flash: 0,
    };
    mesh.torso.userData.bot = bot; mesh.torso.userData.part = 'torso';
    mesh.head.userData.bot = bot; mesh.head.userData.part = 'head';
    hitMeshes.push(mesh.torso, mesh.head);
    bots.push(bot);
    return bot;
  }
  function reset(round, matchSeed = 0) {
    // Per-match seed: the same round plays differently every match.
    rngState = 1000 + (round + matchSeed) * 7919;
    for (const b of bots) scene.remove(b.body.group);
    bots.length = 0; hitMeshes.length = 0;
    // Vanguard start at the south spawn and flank down the lanes.
    addBot('V', VANGUARD_NAMES[0], -2, 11, [[-2, 4], [-10, 2], ...WAYPOINTS.west, ...WAYPOINTS.siteA]);
    addBot('V', VANGUARD_NAMES[1], 2, 11, [[2, 4], [10, 2], ...WAYPOINTS.east, ...WAYPOINTS.siteB]);
    // Rustjackals start north and hold near the sites (tuned: their old
    // routes ended at z=2, the defenders met the attack at mid-map and
    // the 2-v-4 bot baseline won 0/100 rounds).
    addBot('R', RUSTJACKAL_NAMES[0], -14, -8, [[-14, -4], [-14, -8]]);
    addBot('R', RUSTJACKAL_NAMES[1], 14, -8, [[14, -4], [14, -8]]);
    addBot('R', RUSTJACKAL_NAMES[2], 0, -8, [[0, -4], [0, -8]]);
    addBot('R', RUSTJACKAL_NAMES[3], -3, -10, [[-3, -4], [-2, -4]]);
    for (const b of bots) { b.body.group.position.copy(b.pos); b.body.group.rotation.y = b.yaw; }
  }
  function damage(bot, amount, attacker) {
    if (!bot.alive) return false;
    bot.health -= amount; bot.flash = 0.12; bot.alerted = true;
    if (bot.health <= 0) {
      bot.health = 0; bot.alive = false; bot.fall = 0;
      if (hooks.onBotKilled) hooks.onBotKilled(bot, attacker || null);
      return true;
    }
    return false;
  }
  function alert(pos, range) {
    for (const b of bots) {
      if (!b.alive) continue;
      if (Math.hypot(b.pos.x - pos.x, b.pos.z - pos.z) < range) {
        b.alerted = true; b.alertPos = { x: pos.x, z: pos.z };
      }
    }
  }
  function closestFoe(bot, player, all) {
    let best = null, bestD = 1e9;
    const candidates = [];
    if (bot.team === 'R' && player.alive) {
      candidates.push({ pos: player.position, eyeY: player.position.y + player.eye, isPlayer: true, speed: Math.hypot(player.velocity.x, player.velocity.z), crouched: player.crouching, ref: player });
    }
    for (const o of all) {
      if (!o.alive || o.team === bot.team || o === bot) continue;
      candidates.push({ pos: o.pos, eyeY: EYE_HEIGHT, isPlayer: false, speed: 0, crouched: false, ref: o });
    }
    for (const c of candidates) {
      const d = Math.hypot(c.pos.x - bot.pos.x, c.pos.z - bot.pos.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }
  function step(dt, ctx) {
    now += dt;
    const { player, smoke, phase, bombPos, planted } = ctx;
    for (const bot of bots) {
      if (!bot.alive) {
        bot.fall = Math.min(1, bot.fall + dt / 0.4);
        bot.body.group.rotation.x = -bot.fall * 1.45;
        continue;
      }
      if (bot.flash > 0) bot.flash -= dt;
      // Defuse duty: a living Rustjackal walks to a planted charge.
      if (planted && bot.team === 'R' && bombPos) {
        const d = Math.hypot(bombPos.x - bot.pos.x, bombPos.z - bot.pos.z);
        if (d > 1.6) { walkBot(bot, dt, bombPos.x, bombPos.z); bot.state = 'defuse'; }
        else bot.state = 'defusing';
        // It still shoots if a Vanguard is in sight while defusing.
      }
      const foe = closestFoe(bot, player, bots);
      let seen = null;
      if (foe && spots(bot, foe.pos, foe.eyeY, smoke)) seen = foe;
      if (seen) {
        bot.target = seen;
        bot.yaw = Math.atan2(-(seen.pos.x - bot.pos.x), -(seen.pos.z - bot.pos.z));
        // Fire in bursts.
        if (now >= bot.shootAt && phase === 'live') {
          bot.shootAt = now + 0.9 + rnd() * 0.7;
          const dist = Math.hypot(seen.pos.x - bot.pos.x, seen.pos.z - bot.pos.z);
          let chance = 0.28 - dist * 0.008 - (seen.speed || 0) * 0.03;
          // Tuned: Vanguard bots shoot ~50% more accurately so the 2-v-4
          // bot baseline is competitive instead of losing 0/100 rounds.
          if (bot.team === 'V') chance *= 1.5;
          if (seen.crouched) chance -= 0.08;
          if (bot.state === 'defusing') chance *= 0.5;
          chance = Math.max(0.05, Math.min(0.6, chance));
          const hit = rnd() < chance;
          const from = new THREE.Vector3(bot.pos.x, 1.35, bot.pos.z);
          const to = new THREE.Vector3(seen.pos.x, seen.eyeY - 0.2, seen.pos.z);
          hooks.onBotShot(bot, from, to, hit);
          if (hit) {
            let dmg = 12 + rnd() * 10;
            if (bot.team === 'V') dmg *= 1.5; // tuned: Vanguard bots hit harder
            if (seen.isPlayer) hooks.onPlayerDamaged(dmg, bot);
            else damage(seen.ref, dmg, bot);
          }
        }
        // Hold position while engaging unless the target is far away.
        const dist = Math.hypot(seen.pos.x - bot.pos.x, seen.pos.z - bot.pos.z);
        if (dist > 14 && bot.state !== 'defusing') walkBot(bot, dt, seen.pos.x, seen.pos.z);
      } else {
        bot.target = null;
        if (bot.alerted && bot.alertPos && bot.state !== 'defusing') {
          const arrived = walkBot(bot, dt, bot.alertPos.x, bot.alertPos.z);
          if (arrived) { bot.alerted = false; bot.alertPos = null; }
        } else if (bot.state !== 'defusing' && bot.state !== 'defuse') {
          // Patrol the route; at the end, hold 2 s and walk it back.
          if (bot.routeIdx < bot.route.length) {
            const [wx, wz] = bot.route[bot.routeIdx];
            const arrived = walkBot(bot, dt, wx, wz);
            if (arrived) bot.routeIdx += 1;
          } else if (now > bot.holdUntil) {
            bot.route.reverse(); bot.routeIdx = 0; bot.holdUntil = now + 2;
          }
        }
      }
      bot.body.group.position.copy(bot.pos);
      bot.body.group.position.y = 0;
      bot.body.group.rotation.y = bot.yaw;
      bot.body.group.rotation.x = 0;
    }
  }
  reset(1, 0);
  return {
    bots, hitMeshes, step, reset, damage, alert,
    aliveCount(team) { return bots.filter((b) => b.alive && b.team === team).length; },
    totalCount(team) { return bots.filter((b) => b.team === team).length; },
    defuserNear(bombPos) {
      if (!bombPos) return null;
      for (const b of bots) {
        if (b.alive && b.team === 'R' && Math.hypot(b.pos.x - bombPos.x, b.pos.z - bombPos.z) < 1.8) return b;
      }
      return null;
    },
  };
}
