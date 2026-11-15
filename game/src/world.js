// EMBER YARD map: a 36 x 28 m industrial container yard at dusk.
// The Vanguard spawn is south (z +12); north holds Site A (west, x -14)
// and Site B (east, x +14). Three lanes run north: west, mid, east.
// Every box is a movement collider and a surface bullets stop on.
// Plain geometry only — no models, no textures, all original art.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const MAP = { halfX: 18, halfZ: 14, wallH: 4.6 };
export const SITES = {
  A: { name: 'A', x: -14.5, z: -11, r: 2.6 },
  B: { name: 'B', x: 14.5, z: -11, r: 2.6 },
};
// Waypoints bots walk: spawn, lane junctions, site approaches.
export const WAYPOINTS = {
  spawnV: [[-2, 11], [2, 11], [0, 8]],
  spawnE: [[-2, -12.5], [2, -12.5], [0, -10]],
  west: [[-14, 8], [-14, 2], [-14, -4], [-14, -8]],
  mid: [[0, 8], [0, 2], [0, -4], [0, -8]],
  east: [[14, 8], [14, 2], [14, -4], [14, -8]],
  siteA: [[-14, -8], [-14.5, -11]],
  siteB: [[14, -8], [14.5, -11]],
};

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const mats = {};
  for (const name of Object.keys(PALETTE)) {
    mats[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'accent' ? 0.55 : 0.92,
      metalness: 0.03,
    });
  }
  // Brighter materials than the first draft (it read too dark in the
  // browser): light concrete floor, mid-grey walls, pale crates, and
  // ember-orange containers.
  const emberMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c96a20'), roughness: 0.85, metalness: 0.05 });
  const rustMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#8a4a2a'), roughness: 0.9, metalness: 0.05 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#7a7f88'), roughness: 0.95, metalness: 0.02 });
  const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#5d6570'), roughness: 0.92, metalness: 0.02 });
  const crateMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#6a7280'), roughness: 0.9, metalness: 0.02 });
  const colliders = [];
  const shootables = [];
  function placeBox(w, h, d, x, y, z, material, matObj) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matObj || mats[material]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }
  const { halfX, halfZ, wallH } = MAP;
  placeBox(halfX * 2 + 0.8, 0.4, halfZ * 2 + 0.8, 0, -0.2, 0, 'canvas', concreteMat); // floor
  placeBox(0.4, wallH, halfZ * 2 + 0.8, -halfX - 0.2, wallH / 2, 0, 'surface', wallMat); // west wall
  placeBox(0.4, wallH, halfZ * 2 + 0.8, halfX + 0.2, wallH / 2, 0, 'surface', wallMat); // east wall
  placeBox(halfX * 2 + 0.8, wallH, 0.4, 0, wallH / 2, -halfZ - 0.2, 'surface', wallMat); // north wall
  placeBox(halfX * 2 + 0.8, wallH, 0.4, 0, wallH / 2, halfZ + 0.2, 'surface', wallMat); // south wall

  // Container stacks: tall blocks that cut sightlines and split the lanes.
  placeBox(6, 2.6, 2.6, -10, 1.3, 4, 'surface', emberMat); // west lane container
  placeBox(6, 2.6, 2.6, -10, 3.9, 4, 'surface', rustMat); // stacked on top
  placeBox(2.6, 2.6, 6, 10, 1.3, 3, 'surface', emberMat); // east lane container
  placeBox(6, 2.6, 2.6, 6, 1.3, -5, 'surface', rustMat); // mid-east block
  placeBox(2.6, 2.6, 5, -6, 1.3, -5, 'surface', emberMat); // mid-west block
  placeBox(3, 2.6, 2.6, -11, 1.3, -10.5, 'surface', rustMat); // Site A cover, beside the lane
  placeBox(3, 2.6, 2.6, 11, 1.3, -10.5, 'surface', emberMat); // Site B cover, beside the lane
  // Crouch-height crates for cover.
  const crates = [
    [-11, 0.55, 0], [-4, 0.55, 6], [4, 0.55, 6], [11, 0.55, 0],
    [-8, 0.45, -1], [8, 0.45, -1], [-5, 0.55, -8], [5, 0.55, -8],
    [-16.5, 0.55, -8.5], [16.5, 0.55, -8.5], [-7, 0.55, 10], [7, 0.55, 10],
  ];
  for (const [x, y, z] of crates) placeBox(1.6, y * 2, 1.6, x, y, z, 'hairline', crateMat);
  // Low walls splitting mid from the side lanes, gaps at z = 0 and z = -8.
  placeBox(0.5, 1.4, 6, -7, 0.7, 5, 'surface', wallMat);
  placeBox(0.5, 1.4, 6, 7, 0.7, 5, 'surface', wallMat);
  placeBox(0.5, 1.4, 5, -7, 0.7, -11, 'surface', wallMat);
  placeBox(0.5, 1.4, 5, 7, 0.7, -11, 'surface', wallMat);
  // Central pillar at mid.
  placeBox(1.4, 3.4, 1.4, 0, 1.7, 0, 'hairline', crateMat);

  // Site pads (visual only, no collider): ember rings on the floor.
  const pads = [];
  for (const site of Object.values(SITES)) {
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(site.r, 28),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(site.x, 0.02, site.z);
    pad.receiveShadow = true;
    group.add(pad);
    pads.push(pad);
    const marker = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.4), mats.accent);
    marker.position.set(site.x, 0.05, site.z);
    group.add(marker);
  }

  // Dusk lighting: a bright hemisphere, a warm key from the west and a
  // cool fill, with ACES exposure 1.25 in main.js. These values were
  // raised after the first build read too dark in the browser.
  const sky = new THREE.HemisphereLight(new THREE.Color('#5a6f95'), new THREE.Color('#4a3826'), 2.0);
  scene.add(sky);
  const key = new THREE.DirectionalLight(new THREE.Color('#ffb066'), 3.2);
  key.position.set(-14, 16, 6);
  key.target.position.set(0, 0, -3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -22; key.shadow.camera.right = 22;
  key.shadow.camera.top = 20; key.shadow.camera.bottom = -20;
  key.shadow.camera.far = 60;
  key.shadow.bias = -0.0006;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(new THREE.Color(PALETTE.muted), 0.9);
  fill.position.set(10, 9, 12);
  scene.add(fill);
  return { colliders, shootables, group, pads };
}
