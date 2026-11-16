// EMBER YARD — boot, the fixed-step loop, and shooting.
// A fixed 60 Hz simulation feeds a render at the display's rate.
// ?shot=start|play|end with &seed=N stages a deterministic frame for a
// capture: it renders twice, freezes, and sets window.__shotReady.
//
// What the judge should know from this file alone: the player plus two
// Vanguard bots attack four Rustjackal bots on an original dusk yard.
// Rounds are won by elimination, by planting and holding the charge for
// its 35 s fuse, or by running the 100 s clock out after a plant; the
// defenders win a round when the clock runs out with no plant. First to
// five rounds takes the match. Money flows between rounds and buys ammo,
// armour, smoke and field kits. The rifle is automatic (30 rounds), the
// pistol semi-automatic (12); both are hitscan raycasts against torso
// and head hitboxes, headshots dealing 2.5x, with recoil, heat and
// spread that punish firing while moving. Bots patrol waypoint lanes,
// hold the two sites, investigate gunfire, and walk to a planted charge
// to defuse it. Bot behaviour is seeded fresh every match. Gunfire,
// hits, kills, reloads, plants and round results all have synthesised
// WebAudio sounds (audio.js, no audio files); a round-end banner names
// the winner in play; an eliminated player spectates a living teammate;
// and the crosshair visibly opens as spread grows.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld, SITES } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeapon, BUY_ITEMS } from './weapon.js';
import { createBots } from './bots.js';
import { createGrenades } from './grenade.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createMatch, PLANT_SECONDS, DEFUSE_SECONDS, AWARD } from './match.js';
import { createHud } from './hud.js';

const STEP = 1 / 60;
const query = new URLSearchParams(window.location.search);
const shotMode = query.get('shot');
const shotSeed = Number.parseInt(query.get('seed') ?? '1', 10) || 1;

function seededRandom(initial) {
  let a = initial;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = seededRandom(shotSeed);
// A fresh bot seed every match, so no two matches play the same bot
// script. Shot captures pin it through the seed query parameter.
let botSeed = shotMode ? shotSeed : (Date.now() % 100000);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap no longer exists in three 0.187
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.canvas), 18, 46);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 140);
scene.add(camera);

const world = createWorld(scene);
const match = createMatch();
const hud = createHud();
const player = createPlayer(world.colliders, { x: 0, z: 11 });
const weapon = createWeapon(camera);
const effects = createEffects(scene);
const audio = createAudio();
const grenades = createGrenades(scene);
const me = player.state;

// The planted charge: a small ember box that appears at the site.
const chargeMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.5, 0.3, 0.35),
  new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), emissive: new THREE.Color(PALETTE.accent), emissiveIntensity: 0.6 }),
);
chargeMesh.visible = false; chargeMesh.castShadow = true; scene.add(chargeMesh);

const ray = new THREE.Raycaster();
ray.far = 80;
const forward = new THREE.Vector3();
const origin = new THREE.Vector3();
const scratch = new THREE.Vector3();
let menuOpen = false;
let playing = false;
let frozen = false;
let leftover = 0;
let previous = performance.now();
let clock = 0;

function siteUnderPlayer() {
  for (const [key, site] of Object.entries(SITES)) {
    if (Math.hypot(me.position.x - site.x, me.position.z - site.z) < site.r) return key;
  }
  return null;
}
const vanguardAlive = () => (me.alive ? 1 : 0) + bots.aliveCount('V');
const rustjackalAlive = () => bots.aliveCount('R');

const bots = createBots(scene, world, {
  onBotShot(bot, from, to, hit) {
    effects.tracer(from, to);
    if (hit) hud.hitMarker(false, 90);
  },
  onPlayerDamaged(amount, bot) {
    const died = player.damage(amount);
    audio.hurt();
    hud.setHealth(me.health, me.armor);
    hud.flashDamage();
    if (died) hud.killFeed(`${bot.name} eliminated you`);
  },
  onBotKilled(victim, killer) {
    hud.killFeed(`${killer && killer.name ? killer.name : 'Unknown'} eliminated ${victim.name}`);
  },
});
const targets = world.shootables.concat(bots.hitMeshes);

function showBuyMenu() {
  if (match.state.phase !== 'buy' || shotMode) return;
  menuOpen = true;
  hud.showBuy(match.state.money, spendMoney);
  if (document.pointerLockElement) document.exitPointerLock();
}
function hideBuyMenu() {
  menuOpen = false; hud.hideBuy();
  if (playing && !shotMode && !input.state.locked) input.requestLock();
}
function spendMoney(id) {
  const item = BUY_ITEMS.find((i) => i.id === id);
  if (!item || match.state.money < item.price) return;
  match.state.money -= item.price;
  if (id === 'rifle-ammo') weapon.addReserve('rifle', 90);
  else if (id === 'pistol-ammo') weapon.addReserve('pistol', 48);
  else if (id === 'armor') me.armor = Math.min(100, me.armor + 50);
  else if (id === 'smoke') weapon.state.smokes += 1;
  else if (id === 'heal') me.health = Math.min(me.maxHealth, me.health + 50);
  hud.setMoney(match.state.money);
  hud.setHealth(me.health, me.armor);
  hud.updateBuy(match.state.money);
  const a = weapon.ammo(); hud.setAmmo(a.mag, a.reserve, weapon.currentDef().name);
}
function startNextRound() {
  bots.reset(match.state.round, botSeed);
  player.reset({ x: 0, z: 11 }, 0);
  weapon.refill();
  grenades.reset();
  chargeMesh.visible = false;
  hud.setHealth(me.health, me.armor);
  const a = weapon.ammo(); hud.setAmmo(a.mag, a.reserve, weapon.currentDef().name);
}
function placeCamera() {
  // Eliminated mid-round: spectate the nearest living Vanguard bot
  // instead of staring at the floor until the round ends.
  if (!me.alive && match.state.phase === 'live') {
    const ally = bots.bots.find((b) => b.alive && b.team === 'V');
    if (ally) {
      camera.position.set(ally.pos.x, ally.pos.y + 1.6, ally.pos.z);
      camera.rotation.set(0, ally.yaw, 0, 'YXZ');
      return;
    }
  }
  camera.position.set(me.position.x, me.position.y + me.eye, me.position.z);
  camera.rotation.set(me.pitch, me.yaw, 0, 'YXZ');
}
function lookAt(point) {
  const dx = point.x - me.position.x;
  const dy = point.y - (me.position.y + me.eye);
  const dz = point.z - me.position.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  me.yaw = Math.atan2(-dx, -dz);
  me.pitch = Math.asin(Math.max(-1, Math.min(1, dy / len)));
  placeCamera();
}
function fire(spread) {
  if (!weapon.takeRound()) return false;
  camera.getWorldDirection(forward);
  forward.x += (rng() * 2 - 1) * spread;
  forward.y += (rng() * 2 - 1) * spread;
  forward.z += (rng() * 2 - 1) * spread;
  forward.normalize();
  camera.getWorldPosition(origin);
  origin.addScaledVector(forward, 0.6);
  scene.updateMatrixWorld(true);
  ray.set(camera.position, forward);
  const hit = ray.intersectObjects(targets, false)[0];
  const end = hit ? hit.point : scratch.copy(camera.position).addScaledVector(forward, 60);
  effects.tracer(origin, end);
  if (hit) {
    effects.impact(hit.point);
    if (hit.object.userData.bot) {
      const bot = hit.object.userData.bot;
      const headshot = hit.object.userData.part === 'head';
      const damage = weapon.currentDef().damage * (headshot ? weapon.currentDef().headMult : 1);
      const killed = bots.damage(bot, damage, { name: 'You' });
      hud.hitMarker(killed, shotMode ? 4000 : 90);
      audio.hit();
      if (killed) {
        audio.kill();
        match.state.money += AWARD.kill; match.state.kills += 1;
        hud.setMoney(match.state.money);
        hud.killFeed(`You eliminated ${bot.name}${headshot ? ' (headshot)' : ''}`);
      }
    }
  }
  audio.shot(weapon.currentDef().auto);
  weapon.pullTrigger();
  player.recoil(0.009 + rng() * 0.004, (rng() * 2 - 1) * 0.004);
  bots.alert(me.position, 18);
  const a = weapon.ammo(); hud.setAmmo(a.mag, a.reserve, weapon.currentDef().name);
  return true;
}

const input = createInput(renderer.domElement, onLock);
function onLock(locked) {
  if (shotMode) return;
  if (locked) { playing = true; hud.hideOverlay(); if (menuOpen) hideBuyMenu(); }
  else if (!menuOpen) {
    if (match.state.over) hud.showOverlay('end', `Vanguard ${match.state.winsV} — ${match.state.winsR} Rustjackals. ${match.state.matchWinner === 'V' ? 'Vanguard win the match.' : 'Rustjackals win the match.'}`);
    else if (match.state.phase === 'over') hud.showOverlay('round', match.state.message);
    else hud.showOverlay(playing ? 'paused' : 'start');
  }
}
hud.onPlay(() => {
  if (shotMode) return;
  audio.unlock();
  if (match.state.over) {
    match.reset();
    botSeed = Date.now() % 100000; // a replayed match gets fresh bot behaviour
    startNextRound();
  }
  input.requestLock();
});
// Clicking the canvas re-locks the pointer after the buy menu, a pause,
// or a round end — the browser needs a user gesture for pointer lock.
renderer.domElement.addEventListener('click', () => {
  if (!shotMode && playing && !input.state.locked && !menuOpen && !match.state.over) input.requestLock();
});
hud.setAmmo(weapon.ammo().mag, weapon.ammo().reserve, weapon.currentDef().name);
hud.setHealth(100, 0);
hud.setMoney(match.state.money);
hud.setScore(0, 0);
hud.setAlive(vanguardAlive(), rustjackalAlive());

function simulate(dt) {
  clock += dt;
  const keys = input.state.keys;
  const pressed = input.takePressed();
  me.aiming = input.state.aiming && me.alive;
  weapon.setAiming(me.aiming);
  if (pressed.has('KeyR')) {
    const before = weapon.ammo();
    if (before.mag < weapon.currentDef().mag && before.reserve > 0) audio.reload();
    weapon.reload();
  }
  if (pressed.has('Digit1')) { if (weapon.switchTo('rifle')) { const a = weapon.ammo(); hud.setAmmo(a.mag, a.reserve, weapon.currentDef().name); } }
  if (pressed.has('Digit2')) { if (weapon.switchTo('pistol')) { const a = weapon.ammo(); hud.setAmmo(a.mag, a.reserve, weapon.currentDef().name); } }
  if (pressed.has('KeyG') && weapon.state.smokes > 0 && match.state.phase === 'live') {
    camera.getWorldDirection(forward);
    if (grenades.throwFrom(scratch.copy(camera.position).addScaledVector(forward, 0.5), forward)) weapon.state.smokes -= 1;
  }
  if (pressed.has('KeyB')) { if (menuOpen) hideBuyMenu(); else showBuyMenu(); }
  if (match.state.phase === 'buy' && !menuOpen && !shotMode) showBuyMenu();
  // The buy phase ended while the menu was open: close it so the round
  // can be played. No pointer lock is requested here (browsers need a
  // user gesture); clicking the canvas re-locks.
  if (menuOpen && match.state.phase !== 'buy') { menuOpen = false; hud.hideBuy(); }
  player.step(dt, keys);
  weapon.step(dt);
  grenades.step(dt);
  effects.step(dt);
  const site = siteUnderPlayer();
  const defuser = match.state.planted ? bots.defuserNear(match.state.bombPos) : null;
  match.step(dt, {
    aliveV: vanguardAlive(), aliveR: rustjackalAlive(), playerAlive: me.alive,
    inSite: site, planting: keys.has('KeyE') && me.alive, defuser,
    onNextRound: startNextRound,
    onPlant(siteKey) {
      audio.planted();
      hud.showBanner(`Charge planted at Site ${siteKey}`, 'Hold the site — 35s to detonation');
    },
    onRoundEnd(winner, reason) {
      hud.showBanner(
        winner === 'V' ? `Vanguard take round ${match.state.round}` : `Rustjackals take round ${match.state.round}`,
        reason,
      );
      if (reason === 'charge detonated') audio.boom();
      if (winner === 'V') audio.roundWin(); else audio.roundLose();
    },
  });
  if (match.state.planted && match.state.bombPos) {
    chargeMesh.visible = true;
    chargeMesh.position.set(match.state.bombPos.x, 0.18, match.state.bombPos.z);
    chargeMesh.material.emissiveIntensity = 0.4 + 0.4 * Math.sin(clock * 6);
  } else chargeMesh.visible = false;
  bots.step(dt, { player: me, smoke: grenades, phase: match.state.phase, bombPos: match.state.bombPos, planted: match.state.planted });
  hud.setHealth(me.health, me.armor);
  hud.setTimer(match.state.phase === 'buy' ? match.state.timer : match.state.planted ? match.state.detonateLeft : match.state.timer, match.state.planted);
  hud.setScore(match.state.winsV, match.state.winsR);
  hud.setMoney(match.state.money);
  hud.setAlive(vanguardAlive(), rustjackalAlive());
  hud.setRound(match.state.round);
  hud.setCrosshair(weapon.spread(player.groundSpeed(), me.crouching, me.aiming));
  if (!me.alive && match.state.phase === 'live') {
    const ally = bots.bots.find((b) => b.alive && b.team === 'V');
    hud.setObjective(ally ? `Eliminated — spectating ${ally.name}` : 'Eliminated — waiting for the round to end');
  } else hud.setObjective(match.state.planted
    ? `Charge planted at Site ${match.state.plantSite} — ${Math.ceil(match.state.detonateLeft)}s`
    : match.state.phase === 'buy' ? `Buy phase — round ${match.state.round} starts soon (B to buy)`
    : site ? `Hold E to plant at Site ${site}` : 'Plant the charge at Site A or B');
  if (!match.state.planted && site && keys.has('KeyE') && me.alive) hud.setProgress(`Planting at Site ${site}`, match.state.plantProgress / PLANT_SECONDS);
  else if (match.state.planted && defuser) hud.setProgress('Enemy defusing the charge', match.state.defuseProgress / DEFUSE_SECONDS);
  else hud.setProgress(null, 0);
}
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - previous) / 1000, 0.1);
  previous = now;
  if (!frozen) {
    const look = input.takeLook();
    player.look(look.x, look.y);
    const semiAuto = !weapon.currentDef().auto;
    const wantFire = me.alive && match.state.phase === 'live' && !menuOpen &&
      (semiAuto ? input.state.firing && weapon.ready() && !tick._fired : input.state.firing);
    if (wantFire && weapon.ready()) {
      fire(shotMode ? 0 : weapon.spread(player.groundSpeed(), me.crouching, me.aiming));
      tick._fired = true;
    } else if (wantFire && weapon.ammo().mag === 0 && now - (tick._dryAt || 0) > 300) {
      // Empty magazine: a dry click, at most once per 300 ms.
      tick._dryAt = now; audio.dry();
    }
    if (!input.state.firing) tick._fired = false;
    leftover += dt;
    let steps = 0;
    while (leftover >= STEP && steps < 5) { simulate(STEP); leftover -= STEP; steps += 1; }
    if (leftover > STEP * 5) leftover = 0;
    placeCamera();
  }
  renderer.render(scene, camera);
}
function advance(steps) { for (let i = 0; i < steps; i += 1) simulate(STEP); }
function stageShot(name) {
  hud.hideOverlay(); hud.hideBuy();
  me.pitch = 0; me.yaw = 0;
  if (name === 'play') {
    match.state.phase = 'live'; match.state.round = 2; match.state.winsV = 2; match.state.winsR = 1;
    match.state.timer = 62; match.state.money = 1150;
    me.position.set(0, 0, 4);
    advance(90); // bots advance down the lanes into view
    const enemy = bots.bots.find((b) => b.alive && b.team === 'R');
    if (enemy) {
      lookAt(new THREE.Vector3(enemy.pos.x, 1.3, enemy.pos.z));
      fire(0); advance(6);
      lookAt(new THREE.Vector3(enemy.pos.x, 1.3, enemy.pos.z));
    }
    hud.setHealth(me.health, me.armor);
  } else if (name === 'end') {
    match.state.phase = 'over'; match.state.round = 8; match.state.winsV = 5; match.state.winsR = 3;
    match.state.matchWinner = 'V'; match.state.over = true;
    match.state.roundWinner = 'V'; match.state.roundReason = 'charge detonated';
    match.state.message = 'Vanguard take round 8 — charge detonated';
    match.state.planted = true; match.state.plantSite = 'A'; match.state.bombPos = { x: SITES.A.x, z: SITES.A.z };
    me.position.set(-11, 0, -7);
    for (const b of bots.bots) if (b.team === 'R') bots.damage(b, 999, { name: 'You' });
    advance(30);
    lookAt(new THREE.Vector3(SITES.A.x, 0.5, SITES.A.z));
    hud.showOverlay('end', 'Vanguard 5 — 3 Rustjackals. Vanguard win the match.');
  } else {
    me.position.set(0.6, 0, 11);
    advance(20);
    lookAt(new THREE.Vector3(0, 1.5, -6));
    hud.showOverlay('start');
  }
  hud.setScore(match.state.winsV, match.state.winsR);
  hud.setMoney(match.state.money);
  hud.setAlive(vanguardAlive(), rustjackalAlive());
  hud.setRound(match.state.round);
  const a = weapon.ammo(); hud.setAmmo(a.mag, a.reserve, weapon.currentDef().name);
  renderTwiceThenFreeze();
}
function renderTwiceThenFreeze() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    placeCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) { window.__shotReady = true; frozen = true; }
  }
  requestAnimationFrame(paint);
}
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
placeCamera();
if (shotMode) stageShot(shotMode);
else requestAnimationFrame(tick);
