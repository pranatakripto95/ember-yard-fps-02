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

  // Dusk sky: a gradient dome, a low sun and a distant skyline, so the
  // top of the frame is a sunset instead of flat black. All procedural
  // geometry and canvas textures — no image files, no network.
  const skyGeo = new THREE.SphereGeometry(110, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      horizon: { value: new THREE.Color('#96602f') },
      mid: { value: new THREE.Color('#4a3a4d') },
      zenith: { value: new THREE.Color('#20263e') },
    },
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vDir; uniform vec3 horizon; uniform vec3 mid; uniform vec3 zenith; void main() { float h = clamp(vDir.y, 0.0, 1.0); vec3 c = h < 0.25 ? mix(horizon, mid, h / 0.25) : mix(mid, zenith, (h - 0.25) / 0.75); gl_FragColor = vec4(c, 1.0); }',
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyDome);
  // The sun: a radial-gradient sprite low over the west wall.
  const sunCanvas = document.createElement('canvas');
  sunCanvas.width = 128; sunCanvas.height = 128;
  const sunCtx = sunCanvas.getContext('2d');
  const glow = sunCtx.createRadialGradient(64, 64, 4, 64, 64, 64);
  glow.addColorStop(0, 'rgba(255, 190, 110, 1)');
  glow.addColorStop(0.35, 'rgba(240, 140, 50, 0.85)');
  glow.addColorStop(1, 'rgba(240, 120, 40, 0)');
  sunCtx.fillStyle = glow; sunCtx.fillRect(0, 0, 128, 128);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sunCanvas), transparent: true, depthWrite: false, fog: false }));
  sun.position.set(-70, 14, -55); sun.scale.set(34, 34, 1);
  scene.add(sun);
  // Distant rooftops silhouetted against the sky, outside the walls.
  const skylineMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#161a21'), fog: false });
  const skyline = [[-26, 9, -24, 10, 12], [-12, 13, -26, 8, 9], [2, 8, -25, 12, 10], [16, 12, -24, 9, 11], [28, 7, -22, 8, 13], [-30, 11, 4, 9, 10], [30, 9, 6, 10, 12], [-28, 8, 14, 8, 9]];
  for (const [x, h, z, w, d] of skyline) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), skylineMat);
    block.position.set(x, h / 2, z);
    group.add(block);
  }
  // Site letters: big A / B markers floating above the sites so the
  // objective reads from spawn and in every screenshot.
  function siteMarker(letter, x, z) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(20, 22, 26, 0.85)';
    g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#f0a830'; g.lineWidth = 10;
    g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#f0a830'; g.font = 'bold 150px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(letter, 128, 136);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    sprite.position.set(x, 5.6, z); sprite.scale.set(3.2, 3.2, 1);
    scene.add(sprite);
    return sprite;
  }
  siteMarker('A', SITES.A.x, SITES.A.z);
  siteMarker('B', SITES.B.x, SITES.B.z);
  return { colliders, shootables, group, pads };
}
