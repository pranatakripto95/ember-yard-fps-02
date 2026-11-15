// Two hitscan guns, tuned to feel different. The rifle is automatic, 30
// rounds, 34 body damage; the pistol is semi-auto, 12 rounds, 28 body
// damage, faster to draw. main.js owns the ray and the damage; this module
// owns magazines, reloads, spread and the view model. Spread grows with
// movement and sustained fire (heat), and shrinks when still, crouched
// or aiming — stopping to aim pays.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  rifle: { name: 'Ember Rifle', price: 0, mag: 30, reserve: 90, damage: 34, headMult: 2.5, gap: 0.096, reload: 1.9, auto: true, spreadStill: 0.0022, spreadMove: 0.028 },
  pistol: { name: 'Sidearm', price: 0, mag: 12, reserve: 48, damage: 28, headMult: 2.5, gap: 0.22, reload: 1.2, auto: false, spreadStill: 0.004, spreadMove: 0.02 },
};
export const BUY_ITEMS = [
  { id: 'rifle-ammo', label: 'Rifle ammo (+90 reserve)', price: 100 },
  { id: 'pistol-ammo', label: 'Pistol ammo (+48 reserve)', price: 80 },
  { id: 'armor', label: 'Armor (+50)', price: 500 },
  { id: 'smoke', label: 'Smoke grenade', price: 200 },
  { id: 'heal', label: 'Field kit (+50 HP)', price: 300 },
];

export function createWeapon(camera) {
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.35 });
  const model = new THREE.Group();
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.42), bodyMat);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.4), grip);
  barrel.position.set(0, 0.025, -0.38);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.22), grip);
  stock.position.set(0, -0.02, 0.3);
  model.add(receiver, barrel, stock);
  model.position.set(0.24, -0.2, -0.42);
  camera.add(model);
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.18, -0.95); flash.visible = false; camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.6); camera.add(flashLight);

  const state = {
    current: 'rifle',
    guns: {
      rifle: { mag: 30, reserve: 90 },
      pistol: { mag: 12, reserve: 48 },
    },
    cooldown: 0, reloadLeft: 0, flash: 0, kick: 0, heat: 0, smokes: 1,
  };
  function def() { return WEAPONS[state.current]; }
  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.heat = Math.max(0, state.heat - dt * 0.55);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    const aiming = model.userData.aiming;
    model.position.set(aiming ? 0 : 0.24, aiming ? -0.16 : -0.2, -0.42 + state.kick);
    model.rotation.x = state.kick * 2.2;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (def().reload - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const gun = state.guns[state.current];
        const need = def().mag - gun.mag;
        const take = Math.min(need, gun.reserve);
        gun.mag += take; gun.reserve -= take;
      }
    }
  }
  return {
    state, step,
    currentDef() { return def(); },
    setAiming(v) { model.userData.aiming = v; },
    ready() { return state.guns[state.current].mag > 0 && state.cooldown === 0 && state.reloadLeft === 0; },
    pullTrigger() { state.cooldown = def().gap; state.flash = 0.06; state.kick = 0.055; state.heat = Math.min(1, state.heat + 0.09); },
    takeRound() { const g = state.guns[state.current]; if (g.mag <= 0) return false; g.mag -= 1; return true; },
    reload() {
      const g = state.guns[state.current];
      if (state.reloadLeft > 0 || g.mag === def().mag || g.reserve === 0) return;
      state.reloadLeft = def().reload;
    },
    spread(speed, crouching, aiming) {
      const d = def();
      let s = d.spreadStill + Math.min(1, speed / 5.2) * d.spreadMove + state.heat * 0.02;
      if (crouching) s *= 0.7;
      if (aiming) s *= 0.45;
      return s;
    },
    switchTo(name) {
      if (!WEAPONS[name] || name === state.current) return false;
      state.current = name; state.reloadLeft = 0; state.cooldown = 0.25; return true;
    },
    ammo() { const g = state.guns[state.current]; return { mag: g.mag, reserve: g.reserve }; },
    addReserve(name, n) { state.guns[name].reserve += n; },
    refill() {
      state.guns.rifle = { mag: 30, reserve: 90 };
      state.guns.pistol = { mag: 12, reserve: 48 };
      state.current = 'rifle'; state.cooldown = 0; state.reloadLeft = 0; state.flash = 0; state.kick = 0; state.heat = 0; state.smokes = 1;
    },
  };
}
