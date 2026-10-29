// Low-poly toy kit: every prop is baked into one BufferGeometry with vertex colours,
// so it can be drawn many times with a single InstancedMesh.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

export function M(px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(px, py, pz), _q, _s.set(sx, sy, sz));
}

// colour one geometry and transform it
export function part(geo, color, matrix) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (matrix) g.applyMatrix4(matrix);
  g.deleteAttribute('uv');
  const c = new THREE.Color(color);
  const n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
export function bake(parts) {
  const g = mergeGeometries(parts, false);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// ---- primitives (unit sized, origin at bottom centre unless noted) ----
export const G = {
  box: () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  boxc: () => new THREE.BoxGeometry(1, 1, 1),
  cyl: (seg = 7) => new THREE.CylinderGeometry(0.5, 0.5, 1, seg).translate(0, 0.5, 0),
  cylc: (seg = 7) => new THREE.CylinderGeometry(0.5, 0.5, 1, seg),
  cone: (seg = 6) => new THREE.ConeGeometry(0.5, 1, seg).translate(0, 0.5, 0),
  pyr: () => new THREE.ConeGeometry(0.7071, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0),
  ico: (d = 0) => new THREE.IcosahedronGeometry(0.5, d),
  sph: (w = 8, h = 6) => new THREE.SphereGeometry(0.5, w, h),
  gable: () => {   // triangular prism, ridge along x, base 1x1 at y=0, height 1
    const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
    g.translate(0, 0, -0.5); g.rotateY(Math.PI / 2);
    return g;
  },
};

// ---- buildings ----
export function houseBody() { return G.box(); }
export function gableRoof() { return G.gable(); }

export function windowsGeo() {      // emissive window panes on 4 faces of a unit body
  const parts = [];
  const pane = new THREE.BoxGeometry(0.16, 0.2, 0.02);
  for (const [x, ry] of [[0.5, Math.PI / 2], [-0.5, Math.PI / 2]]) {
    for (const zz of [-0.22, 0.22]) parts.push(part(pane, '#ffffff', M(x + Math.sign(x) * 0.005, 0.55, zz, 0, ry, 0)));
  }
  for (const z of [0.5, -0.5]) {
    for (const xx of [-0.25, 0.25]) parts.push(part(pane, '#ffffff', M(xx, 0.55, z + Math.sign(z) * 0.005)));
  }
  return bake(parts);
}
export function towerWindowsGeo() { // bands of windows for towers (unit body, tall)
  const parts = [];
  const band = new THREE.BoxGeometry(1.02, 0.045, 1.02);
  for (let y = 0.12; y < 0.96; y += 0.11) parts.push(part(band, '#ffffff', M(0, y, 0)));
  return bake(parts);
}

export function church() {
  const p = [];
  p.push(part(G.box(), '#F3EBDD', M(0, 0, 0, 0, 0, 0, 1.0, 0.8, 2.0)));
  p.push(part(G.gable(), '#B9583E', M(0, 0.8, 0, 0, Math.PI / 2, 0, 2.08, 0.45, 1.08)));
  p.push(part(G.box(), '#EFE4D2', M(0, 0, 1.05, 0, 0, 0, 0.55, 1.65, 0.55)));
  p.push(part(G.pyr(), '#B9583E', M(0, 1.65, 1.05, 0, 0, 0, 0.62, 0.5, 0.62)));
  p.push(part(G.box(), '#6B4A3A', M(0, 0, 1.33, 0, 0, 0, 0.22, 0.42, 0.02)));
  p.push(part(G.box(), '#DCCFB8', M(0, 0.95, 1.33, 0, 0, 0, 0.2, 0.2, 0.02)));
  return bake(p);
}
export function nipaHut() {
  const p = [];
  for (const [x, z] of [[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]])
    p.push(part(G.cyl(5), '#8B6A47', M(x, 0, z, 0, 0, 0, 0.07, 0.25, 0.07)));
  p.push(part(G.box(), '#D8BF8E', M(0, 0.22, 0, 0, 0, 0, 0.82, 0.42, 0.82)));
  p.push(part(G.pyr(), '#C49A5C', M(0, 0.62, 0, 0, 0, 0, 1.25, 0.55, 1.25)));
  p.push(part(G.box(), '#6E5034', M(0, 0.24, 0.415, 0, 0, 0, 0.22, 0.3, 0.02)));
  return bake(p);
}
export function umbrella() {
  const p = [];
  p.push(part(G.cyl(5), '#F4F1EA', M(0, 0, 0, 0, 0, 0, 0.035, 0.42, 0.035)));
  p.push(part(G.cone(8), '#ffffff', M(0, 0.38, 0, 0, 0, 0, 0.62, 0.16, 0.62)));
  return bake(p);
}
export function lounger() {
  const p = [];
  p.push(part(G.box(), '#F6F2EA', M(0, 0.05, 0, 0, 0, 0, 0.18, 0.04, 0.42)));
  p.push(part(G.box(), '#F6F2EA', M(0, 0.07, -0.18, -0.6, 0, 0, 0.18, 0.04, 0.16)));
  return bake(p);
}
export function lamp() {
  const p = [];
  p.push(part(G.cyl(5), '#3F4A52', M(0, 0, 0, 0, 0, 0, 0.04, 0.55, 0.04)));
  p.push(part(G.box(), '#3F4A52', M(0, 0.53, 0.05, 0, 0, 0, 0.04, 0.03, 0.14)));
  return bake(p);
}
export function bulb() { return bake([part(G.ico(0), '#ffffff', M(0, 0.5, 0.11, 0, 0, 0, 0.09, 0.07, 0.09))]); }

// ---- vegetation ----
export function palm(seed = 0) {
  const p = [];
  const lean = 0.18 + (seed % 3) * 0.06;
  let x = 0, y = 0;
  for (let i = 0; i < 4; i++) {
    const h = 0.26;
    p.push(part(G.cyl(5), i % 2 ? '#9A7650' : '#A8845B', M(x, y, 0, 0, 0, -lean * (0.4 + i * 0.25), 0.065 - i * 0.008, h + 0.02, 0.065 - i * 0.008)));
    x += Math.sin(lean * (0.4 + i * 0.25)) * h; y += Math.cos(lean * (0.4 + i * 0.25)) * h;
  }
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    const col = i % 2 ? '#5DA548' : '#4E9640';
    const g = new THREE.ConeGeometry(0.12, 0.62, 3).rotateX(Math.PI / 2).translate(0, 0, 0.3);
    p.push(part(g, col, M(x, y, 0, 0.35, a, 0, 1, 0.35, 1)));
  }
  p.push(part(G.ico(0), '#7A5B2E', M(x + 0.04, y - 0.06, 0.03, 0, 0, 0, 0.09, 0.09, 0.09)));
  return bake(p);
}
export function roundTree() {
  const p = [];
  p.push(part(G.cyl(5), '#8A6845', M(0, 0, 0, 0, 0, 0, 0.09, 0.32, 0.09)));
  p.push(part(G.ico(0), '#7DB451', M(0, 0.55, 0, 0, 0.3, 0, 0.62, 0.56, 0.62)));
  p.push(part(G.ico(0), '#6FA748', M(0.14, 0.72, 0.06, 0, 1, 0, 0.36, 0.34, 0.36)));
  return bake(p);
}
export function mahogany() {
  const p = [];
  p.push(part(G.cyl(5), '#6E5038', M(0, 0, 0, 0, 0, 0, 0.08, 0.7, 0.08)));
  p.push(part(G.ico(0), '#3F7B3A', M(0, 0.95, 0, 0, 0, 0, 0.5, 0.75, 0.5)));
  p.push(part(G.ico(0), '#468541', M(0, 1.28, 0, 0, 0.5, 0, 0.34, 0.4, 0.34)));
  return bake(p);
}
export function bush() {
  return bake([part(G.ico(0), '#86BC5A', M(0, 0.14, 0, 0, 0, 0, 0.38, 0.3, 0.38)),
               part(G.ico(0), '#76B04F', M(0.14, 0.1, 0.05, 0, 0.7, 0, 0.24, 0.2, 0.24))]);
}
export function hillDome() {   // Chocolate Hills: rounded haystack mound
  const pts = [];
  for (let i = 0; i <= 7; i++) {
    const t = i / 7;
    pts.push(new THREE.Vector2(Math.cos(t * Math.PI / 2) * 0.5, Math.sin(t * Math.PI / 2) * 1.0));
  }
  pts[0].x = 0.56;
  const g = new THREE.LatheGeometry(pts, 10);
  return bake([part(g, '#FFFFFF', null)]);   // tinted per instance (brown .. green)
}

// ---- boats ----
export function banca(trim = '#2F7FB6') {
  const p = [];
  const hullS = new THREE.Shape();
  hullS.moveTo(0, -0.95); hullS.quadraticCurveTo(0.16, -0.5, 0.15, 0); hullS.quadraticCurveTo(0.16, 0.55, 0, 1.0);
  hullS.quadraticCurveTo(-0.16, 0.55, -0.15, 0); hullS.quadraticCurveTo(-0.16, -0.5, 0, -0.95);
  const hull = new THREE.ExtrudeGeometry(hullS, { depth: 0.16, bevelEnabled: false, curveSegments: 5 });
  hull.rotateX(Math.PI / 2); hull.translate(0, 0.16, 0);
  p.push(part(hull, '#F7F5F0', null));
  p.push(part(G.box(), trim, M(0, 0.15, 0, 0, 0, 0, 0.31, 0.03, 1.4)));
  // canopy
  p.push(part(G.box(), '#F3E3C2', M(0, 0.36, -0.1, 0, 0, 0, 0.34, 0.02, 0.8)));
  for (const [x, z] of [[-0.14, -0.45], [0.14, -0.45], [-0.14, 0.25], [0.14, 0.25]])
    p.push(part(G.cyl(4), '#8B6A47', M(x, 0.16, z, 0, 0, 0, 0.02, 0.2, 0.02)));
  // outriggers (katig) + bamboo arms
  for (const s of [-1, 1]) {
    p.push(part(G.cylc(5), '#D9C089', M(s * 0.78, 0.06, 0, Math.PI / 2, 0, 0, 0.05, 1.6, 0.05)));
    for (const z of [-0.35, 0.35]) p.push(part(G.cylc(4), '#C8AE77', M(s * 0.39, 0.2, z, 0, 0, Math.PI / 2 + s * 0.18, 0.025, 0.82, 0.025)));
  }
  return bake(p);
}
export function ferry() {
  const p = [];
  p.push(part(G.box(), '#F6F6F2', M(0, 0, 0, 0, 0, 0, 0.9, 0.32, 2.6)));
  p.push(part(G.box(), '#2C6FA8', M(0, 0.1, 0, 0, 0, 0, 0.92, 0.07, 2.62)));
  p.push(part(G.box(), '#FBFBF8', M(0, 0.32, 0.1, 0, 0, 0, 0.78, 0.3, 1.6)));
  p.push(part(G.box(), '#2E3E4C', M(0, 0.43, 0.1, 0, 0, 0, 0.8, 0.08, 1.62)));
  p.push(part(G.box(), '#FBFBF8', M(0, 0.62, 0.45, 0, 0, 0, 0.6, 0.18, 0.55)));
  p.push(part(G.cone(4), '#F6F6F2', M(0, 0, 1.3, Math.PI / 2, Math.PI / 4, 0, 0.9, 0.5, 0.32)));
  return bake(p);
}
export function plane() {
  const p = [];
  p.push(part(G.cylc(8), '#F7F7F5', M(0, 0.3, 0, Math.PI / 2, 0, 0, 0.26, 2.2, 0.26)));
  p.push(part(G.cone(8), '#F7F7F5', M(0, 0.3, 1.1, Math.PI / 2, 0, 0, 0.26, 0.4, 0.26)));
  p.push(part(G.box(), '#E9EDF0', M(0, 0.24, 0.05, 0, 0, 0, 2.3, 0.05, 0.45)));
  p.push(part(G.box(), '#E9EDF0', M(0, 0.3, -0.95, 0, 0, 0, 0.9, 0.04, 0.25)));
  p.push(part(G.box(), '#3D4B57', M(0, 0.3, -1.0, 0, 0, 0, 0.04, 0.5, 0.3)));
  p.push(part(G.box(), '#2D3A44', M(0, 0.36, 0.95, 0, 0, 0, 0.27, 0.05, 0.12)));
  return bake(p);
}
export function van() {
  const p = [];
  p.push(part(G.box(), '#F4F4F2', M(0, 0.06, 0, 0, 0, 0, 0.34, 0.3, 0.72)));
  p.push(part(G.box(), '#3A4652', M(0, 0.24, 0.05, 0, 0, 0, 0.35, 0.08, 0.6)));
  for (const [x, z] of [[-0.17, 0.24], [0.17, 0.24], [-0.17, -0.24], [0.17, -0.24]])
    p.push(part(G.cylc(6), '#222', M(x, 0.06, z, 0, 0, Math.PI / 2, 0.11, 0.05, 0.11)));
  return bake(p);
}

// ---- vertex shading helper: colour a baked part by its local height ----
export function shadeBands(g, bands) {
  // bands: [[yMin, '#hex'], ...] evaluated top-down; first match wins
  const pos = g.attributes.position, col = g.attributes.color, c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    let hex = bands[bands.length - 1][1];
    for (const [ym, h] of bands) { if (y >= ym) { hex = h; break; } }
    c.set(hex); col.setXYZ(i, c.r, c.g, c.b);
  }
  return g;
}

// flat aerofoil: shape points are (x, distanceBackFromOrigin); extruded thin in Y
function flatFoil(pts, thick) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);            // (x,y,z) -> (x, z, -y): shape y becomes backward z
  g.translate(0, -thick / 2, 0);
  return g;
}
// vertical fin: shape points are (distanceBack, up); extruded thin in X
function flatFin(pts, thick) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
  g.rotateY(Math.PI / 2);             // (x,y,z) -> (z, y, -x): shape x becomes backward z
  g.translate(-thick / 2, 0, 0);
  return g;
}

/* STARLUX widebody (A350-like). Livery checked against official fleet photos on
   Wikimedia Commons, 2026-10-26: white upper fuselage and white tail, dark navy
   belly, a bronze/gold waistline sweeping up to the tail root, bronze
   parallelograms plus a dark star on the fin, dark navy engine nacelles and
   dark navy STARLUX titles on the forward upper fuselage.
   Nose points +z; the model is about 2.0 long and 1.9 across at scale 1. */
const SL = { white: '#F6F7F9', obsidian: '#3C434B', gold: '#C79A74', dark: '#23282D', glass: '#1A2430' };  // checked 2026-10-26: white fuselage, 'Obsidian Grey' fin, rose-gold accents

export function starluxPlane() {
  const p = [];
  const bands = [[-0.030, SL.white], [-0.046, SL.gold], [-99, SL.white]];   // white body, one rose-gold pinstripe

  // fuselage
  const body = new THREE.CylinderGeometry(0.105, 0.098, 1.46, 14).rotateX(Math.PI / 2);
  p.push(part(shadeBands(colored(body), bands), null, M(0, 0, 0.04)));
  // nose
  const nose = new THREE.SphereGeometry(0.105, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2);
  p.push(part(shadeBands(colored(nose), bands), null, M(0, 0, 0.77, 0, 0, 0, 1, 1, 1.9)));
  // tail cone, lifted slightly like a real upswept tail
  const tail = new THREE.CylinderGeometry(0.098, 0.022, 0.62, 12).rotateX(Math.PI / 2);
  p.push(part(shadeBands(colored(tail), bands), null, M(0, 0.035, -0.98, -0.1, 0, 0)));

  // cockpit glass + cabin window line + STARLUX titles
  p.push(part(G.boxc(), SL.glass, M(0, 0.045, 0.84, 0, 0, 0, 0.13, 0.035, 0.1)));
  for (const s of [-1, 1]) {
    p.push(part(G.boxc(), SL.dark, M(s * 0.102, 0.03, 0.05, 0, 0, 0, 0.012, 0.022, 1.25)));
    p.push(part(G.boxc(), SL.obsidian, M(s * 0.104, 0.062, 0.33, 0, 0, 0, 0.012, 0.042, 0.44)));
  }
  // bronze waistline sweeping up to the tail root
  for (const s of [-1, 1]) p.push(part(G.boxc(), SL.gold, M(s * 0.103, -0.012, -0.62, 0.22, 0, 0, 0.012, 0.055, 0.5)));

  // main wings
  const wing = [[0.085, 0.00], [0.88, 0.50], [0.94, 0.66], [0.085, 0.40]];
  for (const s of [-1, 1]) {
    const g = flatFoil(wing.map(([x, b]) => [x * s, b]), 0.028);
    p.push(part(g, SL.white, M(0, -0.028, 0.16)));
    // wingtip
    p.push(part(G.boxc(), SL.obsidian, M(s * 0.93, -0.012, -0.42, 0, s * 0.5, 0, 0.02, 0.07, 0.14)));
  }
  // engines
  for (const s of [-1, 1]) {
    p.push(part(new THREE.CylinderGeometry(0.082, 0.072, 0.30, 12).rotateX(Math.PI / 2), SL.obsidian, M(s * 0.40, -0.115, 0.14)));
    p.push(part(new THREE.CylinderGeometry(0.084, 0.084, 0.03, 12).rotateX(Math.PI / 2), SL.dark, M(s * 0.40, -0.115, 0.29)));
    p.push(part(G.boxc(), SL.white, M(s * 0.40, -0.055, 0.18, 0, 0, 0, 0.03, 0.08, 0.12)));
  }
  // horizontal stabiliser
  const hs = [[0.05, 0.00], [0.40, 0.21], [0.43, 0.31], [0.05, 0.17]];
  for (const s of [-1, 1]) p.push(part(flatFoil(hs.map(([x, b]) => [x * s, b]), 0.02), SL.white, M(0, 0.055, -1.12)));
  // vertical fin, white with bronze marks and a dark star
  p.push(part(flatFin([[0, 0], [0.36, 0.60], [0.50, 0.60], [0.27, 0]], 0.024), SL.obsidian, M(0, 0.06, -0.96)));
  p.push(part(G.boxc(), SL.gold, M(0, 0.36, -1.20, 0, 0, -0.62, 0.028, 0.17, 0.055)));
  p.push(part(G.boxc(), SL.gold, M(0, 0.225, -1.12, 0, 0, -0.62, 0.028, 0.17, 0.055)));
  p.push(part(G.ico(0), SL.white, M(0, 0.50, -1.30, 0, 0, 0.8, 0.030, 0.055, 0.055)));
  // fin root fairing in bronze
  p.push(part(flatFin([[0, 0], [0.30, 0.09], [0.46, 0.09], [0.46, 0]], 0.024), SL.gold, M(0, 0.055, -0.96)));

  return bake(p);
}
// nav lights are a separate mesh so the phase system can light them on their own
export function planeLights() {
  return {
    red:   bake([part(G.ico(0), '#ffffff', M(-0.95, -0.015, -0.46, 0, 0, 0, 0.05, 0.05, 0.05))]),
    green: bake([part(G.ico(0), '#ffffff', M(0.95, -0.015, -0.46, 0, 0, 0, 0.05, 0.05, 0.05))]),
    tail:  bake([part(G.ico(0), '#ffffff', M(0, 0.10, -1.30, 0, 0, 0, 0.045, 0.045, 0.045)),
                 part(G.ico(0), '#ffffff', M(0, -0.10, 0.20, 0, 0, 0, 0.045, 0.045, 0.045))]),
  };
}
function colored(g) {
  const n = g.attributes.position.count;
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  return g;
}

/* A chocolate bar: thickness, moulded squares, a few highlights and a torn wrapper. */
export function chocolateBar() {
  const p = [];
  const BAR = '#4A2C17', TOP = '#5E3A1E', EDGE = '#3A2110', FOIL = '#C9CDD2', WRAP = '#8C3B2A';
  p.push(part(G.boxc(), BAR, M(0, 0, 0, 0, 0, 0, 1.0, 0.16, 0.62)));
  // moulded squares on top
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    p.push(part(G.boxc(), TOP, M(-0.375 + i * 0.25, 0.085, -0.15 + j * 0.30, 0, 0, 0, 0.205, 0.035, 0.245)));
  }
  // grooves
  for (let i = 1; i < 4; i++) p.push(part(G.boxc(), EDGE, M(-0.5 + i * 0.25, 0.088, 0, 0, 0, 0, 0.022, 0.03, 0.62)));
  p.push(part(G.boxc(), EDGE, M(0, 0.088, 0, 0, 0, 0, 1.0, 0.03, 0.022)));
  // torn wrapper at one end: foil inside, coloured paper outside
  p.push(part(G.boxc(), FOIL, M(-0.56, 0.0, 0, 0, 0.12, 0, 0.22, 0.2, 0.68)));
  p.push(part(G.boxc(), WRAP, M(-0.62, 0.0, 0, 0, 0.12, 0, 0.14, 0.23, 0.72)));
  p.push(part(G.boxc(), FOIL, M(-0.44, 0.115, 0.1, -0.5, 0.4, 0.2, 0.2, 0.012, 0.3)));
  return bake(p);
}

/* Loboc river cruise: a wide bamboo pontoon with a canopy, railings and tables.
   Deliberately unlike the sea ferry — flat, open and roofed. Bow points +z. */
export function cruiseBoat() {
  const p = [];
  const DECK = '#C9A86B', POST = '#7A5B3A', ROOF = '#C2452F', RAIL = '#E6D9BC', TABLE = '#F2EADA';
  // twin bamboo pontoons
  for (const s of [-1, 1]) p.push(part(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 8).rotateX(Math.PI / 2), '#A88450', M(s * 0.22, -0.03, 0)));
  // deck
  p.push(part(G.boxc(), DECK, M(0, 0.05, 0, 0, 0, 0, 0.62, 0.05, 1.5)));
  p.push(part(G.boxc(), '#B08E55', M(0, 0.03, 0, 0, 0, 0, 0.66, 0.02, 1.54)));
  // bow taper
  p.push(part(G.cone(4), DECK, M(0, 0.03, 0.78, Math.PI / 2, Math.PI / 4, 0, 0.62, 0.22, 0.05)));
  // railings
  for (const s of [-1, 1]) {
    p.push(part(G.boxc(), RAIL, M(s * 0.30, 0.17, 0, 0, 0, 0, 0.02, 0.025, 1.46)));
    for (let z = -0.65; z <= 0.66; z += 0.26) p.push(part(G.boxc(), RAIL, M(s * 0.30, 0.11, z, 0, 0, 0, 0.018, 0.14, 0.018)));
  }
  // canopy posts + roof
  for (const s of [-1, 1]) for (const z of [-0.6, -0.1, 0.45]) p.push(part(G.cyl(5), POST, M(s * 0.27, 0.07, z, 0, 0, 0, 0.035, 0.34, 0.035)));
  p.push(part(G.boxc(), ROOF, M(0, 0.425, -0.05, 0, 0, 0, 0.70, 0.04, 1.42)));
  p.push(part(G.boxc(), '#9E3524', M(0, 0.455, -0.05, 0, 0, 0, 0.30, 0.03, 1.44)));
  // tables and benches
  for (const z of [-0.5, 0.0, 0.5]) {
    p.push(part(G.boxc(), TABLE, M(0, 0.20, z, 0, 0, 0, 0.26, 0.03, 0.22)));
    for (const s of [-1, 1]) p.push(part(G.boxc(), '#D8C49A', M(s * 0.20, 0.145, z, 0, 0, 0, 0.1, 0.025, 0.24)));
  }
  return bake(p);
}

// ---- Philippine tarsier: tiny body, huge forward eyes, long thin tail.
// Built facing +z, clinging upright; the head is a separate group so it can turn.
export function tarsierBody() {
  const F = '#9A8468', FL = '#C3B295', SK = '#6E5B45', EY = '#F4C542', PU = '#1A1208';
  const p = [];
  p.push(part(G.sph(10, 8), F, M(0, 0.30, 0, 0.18, 0, 0, 0.30, 0.38, 0.30)));      // trunk
  p.push(part(G.sph(10, 8), FL, M(0, 0.27, 0.07, 0.18, 0, 0, 0.21, 0.28, 0.20)));   // pale belly
  for (const s of [-1, 1]) {                                                         // folded legs
    p.push(part(G.sph(7, 5), F, M(s * 0.13, 0.20, 0.03, 0, 0, s * 0.5, 0.11, 0.20, 0.12)));
    p.push(part(G.sph(6, 5), SK, M(s * 0.14, 0.09, 0.09, 0, 0, 0, 0.07, 0.07, 0.11)));  // foot
    p.push(part(G.sph(7, 5), F, M(s * 0.14, 0.36, 0.06, 0, 0, s * 0.35, 0.08, 0.17, 0.08))); // arm
    p.push(part(G.sph(6, 5), SK, M(s * 0.145, 0.45, 0.11, 0, 0, 0, 0.055, 0.055, 0.07))); // hand
  }
  // tail: a chain of shrinking segments curving away behind
  for (let i = 0; i < 7; i++) {
    const t = i / 6, a = -0.55 - t * 0.5;
    p.push(part(G.sph(5, 4), i > 4 ? FL : SK,
      M(0, 0.20 - Math.sin(a) * 0.04 - t * 0.14, -0.10 - t * 0.34, 0, 0, 0,
        0.055 - t * 0.022, 0.055 - t * 0.022, 0.085)));
  }
  return bake(p);
}
export function tarsierHead() {
  const F = '#9A8468', FL = '#C9B89C', EY = '#F2C230', PU = '#140E05', SK = '#6E5B45';
  const p = [];
  p.push(part(G.sph(10, 8), F, M(0, 0, 0, 0, 0, 0, 0.30, 0.29, 0.27)));             // skull
  p.push(part(G.sph(8, 6), FL, M(0, -0.05, 0.10, 0, 0, 0, 0.19, 0.16, 0.14)));      // muzzle
  for (const s of [-1, 1]) {
    p.push(part(G.sph(10, 8), EY, M(s * 0.095, 0.035, 0.115, 0, 0, 0, 0.145, 0.145, 0.13))); // huge eye
    p.push(part(G.sph(8, 6), PU, M(s * 0.097, 0.035, 0.168, 0, 0, 0, 0.072, 0.072, 0.05))); // pupil
    p.push(part(G.sph(7, 6), SK, M(s * 0.17, 0.13, -0.02, 0.2, s * 0.3, 0, 0.13, 0.15, 0.05))); // ear
  }
  p.push(part(G.sph(5, 4), PU, M(0, -0.065, 0.185, 0, 0, 0, 0.045, 0.035, 0.03)));  // nose
  return bake(p);
}
// a bare perch for the tarsier to cling to
export function perch() {
  const p = [];
  p.push(part(G.cyl(7), '#6B543C', M(0, 0, 0, 0, 0, 0, 0.09, 1.95, 0.09)));
  p.push(part(G.cyl(6), '#6B543C', M(0.16, 1.55, 0, 0, 0.4, 0.95, 0.055, 0.7, 0.055)));
  p.push(part(G.sph(7, 5), '#5F8F43', M(0.62, 2.30, 0.10, 0, 0, 0, 0.42, 0.22, 0.38)));
  p.push(part(G.sph(7, 5), '#6DA14E', M(-0.34, 2.52, -0.16, 0, 0, 0, 0.38, 0.20, 0.34)));
  return bake(p);
}
// Virgin Island sandbar: a long low spit of pale sand
export function sandbar() {
  const p = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8, x = (t - 0.5) * 2.0, w = 0.62 * Math.cos((t - 0.5) * 2.1);
    p.push(part(G.sph(9, 5), i % 2 ? '#F3E6CB' : '#EFDFC0',
      M(x, 0, Math.sin(t * 2.4) * 0.16, 0, 0, 0, Math.max(0.12, w), 0.11, Math.max(0.1, w * 0.52))));
  }
  return bake(p);
}
