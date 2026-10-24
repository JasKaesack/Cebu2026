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
  const g = new THREE.LatheGeometry(pts, 9);
  return bake([part(g, '#86A04A', null)]);
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
