// Marine life, divers and the 16 people on land.
// All movement is procedural: every creature picks its own random targets inside
// the sea (or the walkable beach), with its own speed, turning rate, depth and pauses.
import * as THREE from 'three';
import * as K from './kit.js';
import { mulberry32 } from './field.js';

const TAU = Math.PI * 2;
const wrapA = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

/* ------------------------------------------------------------------ geometry builders */
function ellipsoidDots(parts, c, r, n, rnd, color, size, yMin = 0.15) {
  for (let i = 0; i < n; i++) {
    const u = rnd() * TAU, v = Math.acos(1 - rnd() * (1 - yMin));   // upper part only
    const nx = Math.sin(v) * Math.cos(u), ny = Math.cos(v), nz = Math.sin(v) * Math.sin(u);
    const p = new THREE.Vector3(c[0] + nx * r[0] * 1.005, c[1] + ny * r[1] * 1.005, c[2] + nz * r[2] * 1.005);
    const s = size * (0.6 + rnd() * 0.7);
    parts.push(K.part(K.G.ico(0), color, K.M(p.x, p.y, p.z, 0, 0, 0, s, s * 0.45, s)));
  }
}
function shadeByHeight(g, top, belly, y0, y1) {
  const a = new THREE.Color(top), b = new THREE.Color(belly);
  const pos = g.attributes.position, col = g.attributes.color, c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - y0) / (y1 - y0)));
    c.copy(b).lerp(a, t * t * (3 - 2 * t));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  return g;
}
function finShape(pts, depth = 0.02) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
}

function buildWhaleShark(rnd, mat) {
  const root = new THREE.Group(), body = new THREE.Group(), tail = new THREE.Group();
  root.add(body); body.add(tail);
  const front = [];
  const head = K.part(K.G.sph(12, 8), '#fff', K.M(0, 0, 1.05, 0, 0, 0, 0.82, 0.36, 0.95));
  const trunk = K.part(K.G.sph(12, 8), '#fff', K.M(0, 0.02, 0.25, 0, 0, 0, 0.74, 0.5, 1.7));
  shadeByHeight(head, '#3B5163', '#D9E1E3', -0.12, 0.08); shadeByHeight(trunk, '#3B5163', '#D9E1E3', -0.16, 0.12);
  front.push(head, trunk);
  front.push(K.part(K.G.boxc(), '#1C2730', K.M(0, -0.05, 1.5, 0, 0, 0, 0.5, 0.03, 0.04)));       // wide mouth
  for (const s of [-1, 1]) front.push(K.part(K.G.ico(0), '#11181E', K.M(s * 0.36, 0.02, 1.25, 0, 0, 0, 0.04, 0.04, 0.04)));
  ellipsoidDots(front, [0, 0, 1.05], [0.41, 0.18, 0.47], 22, rnd, '#EEF3F2', 0.05, 0.25);
  ellipsoidDots(front, [0, 0.02, 0.25], [0.37, 0.25, 0.85], 46, rnd, '#EEF3F2', 0.06, 0.2);
  // three faint ridges
  for (const x of [-0.16, 0, 0.16]) front.push(K.part(K.G.boxc(), '#4B6273', K.M(x, 0.245 - Math.abs(x) * 0.25, 0.25, 0, 0, 0, 0.02, 0.02, 1.2)));
  const dorsal = finShape([[0, 0], [0.42, 0], [0.12, 0.45]], 0.04);
  front.push(K.part(dorsal, '#3B5163', K.M(0, 0.22, -0.05, 0, -Math.PI / 2, 0, 1, 1, 1)));
  for (const s of [-1, 1]) {
    const pec = finShape([[0, 0], [0.5, -0.05], [0.12, 0.28]], 0.03);
    front.push(K.part(pec, '#3D5466', K.M(s * 0.3, -0.12, 0.55, Math.PI / 2, s > 0 ? Math.PI : 0, s * 0.35, 1, 1, 1)));
  }
  body.add(new THREE.Mesh(K.bake(front), mat));
  const back = [];
  const stalk = K.part(K.G.sph(10, 6), '#fff', K.M(0, 0, -0.55, 0, 0, 0, 0.36, 0.32, 1.2));
  shadeByHeight(stalk, '#3B5163', '#C9D3D6', -0.1, 0.1); back.push(stalk);
  ellipsoidDots(back, [0, 0, -0.55], [0.18, 0.16, 0.6], 16, rnd, '#EEF3F2', 0.045, 0.2);
  const caudal = finShape([[0, 0], [-0.32, 0.72], [-0.12, 0.08], [-0.26, -0.42]], 0.09);
  back.push(K.part(caudal, '#344A5A', K.M(0, 0, -1.05, 0, -Math.PI / 2, 0, 1, 1, 1)));
  const tm = new THREE.Mesh(K.bake(back), mat); tail.add(tm);
  tail.position.set(0, 0, -0.35); tm.position.z = 0.35;
  root.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return { root, body, tail };
}

function buildTurtle(rnd, mat) {
  const root = new THREE.Group();
  const parts = [];
  const shell = K.part(K.G.ico(1), '#fff', K.M(0, 0.04, 0, 0, 0, 0, 0.5, 0.2, 0.62));
  shadeByHeight(shell, '#6E6A35', '#D8CBA0', -0.02, 0.1); parts.push(shell);
  ellipsoidDots(parts, [0, 0.04, 0], [0.25, 0.1, 0.31], 10, rnd, '#4E4A24', 0.09, 0.4);
  parts.push(K.part(K.G.ico(0), '#9C9A64', K.M(0, 0.04, 0.38, 0, 0, 0, 0.14, 0.11, 0.17)));
  for (const s of [-1, 1]) parts.push(K.part(K.G.ico(0), '#1B1B12', K.M(s * 0.05, 0.07, 0.44, 0, 0, 0, 0.02, 0.02, 0.02)));
  for (const s of [-1, 1]) parts.push(K.part(K.G.boxc(), '#8E8A57', K.M(s * 0.16, 0.0, -0.28, 0, s * 0.5, 0, 0.12, 0.03, 0.13)));
  root.add(new THREE.Mesh(K.bake(parts), mat));
  const flips = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.2, 0.02, 0.17);
    const g = finShape([[0, 0], [s * 0.36, -0.1], [s * 0.33, -0.25], [s * 0.06, -0.17]], 0.03);
    const m = new THREE.Mesh(K.bake([K.part(g, '#8A8653', K.M(0, 0, 0, -Math.PI / 2, 0, 0, 1, 1, 1))]), mat);
    piv.add(m); root.add(piv); flips.push({ piv, s });
  }
  return { root, flips };
}

function buildDiver(kind, opts, mat) {
  // oriented +z forward (head), y up (back)
  const root = new THREE.Group();
  const suit = opts.suit, accent = opts.accent, skin = opts.skin;
  const p = [];
  p.push(K.part(K.G.boxc(), suit, K.M(0, 0, 0, 0, 0, 0, 0.17, 0.1, 0.3)));
  p.push(K.part(K.G.boxc(), accent, K.M(0, 0.051, 0.02, 0, 0, 0, 0.04, 0.005, 0.26)));
  p.push(K.part(K.G.ico(1), kind === 'free' ? suit : '#1E242A', K.M(0, 0.01, 0.21, 0, 0, 0, 0.12, 0.12, 0.13)));  // hood
  p.push(K.part(K.G.boxc(), skin, K.M(0, -0.025, 0.268, 0, 0, 0, 0.07, 0.04, 0.012)));                           // face
  p.push(K.part(K.G.boxc(), '#9ED6F0', K.M(0, -0.012, 0.276, 0, 0, 0, 0.09, 0.04, 0.014)));                      // mask lens
  p.push(K.part(K.G.boxc(), '#20262C', K.M(0, -0.012, 0.27, 0, 0, 0, 0.1, 0.05, 0.01)));                          // mask frame
  if (kind === 'free') {
    for (const s of [-1, 1]) p.push(K.part(K.G.boxc(), suit, K.M(s * 0.1, -0.005, 0.03, 0, 0, 0, 0.045, 0.045, 0.24)));   // arms along body
    p.push(K.part(K.G.cylc(5), '#F2C230', K.M(-0.07, 0.07, 0.24, 0.3, 0, 0, 0.014, 0.12, 0.014)));                         // snorkel
  } else {
    p.push(K.part(K.G.boxc(), '#2B3238', K.M(0, 0.015, 0, 0, 0, 0, 0.2, 0.12, 0.22)));                                   // BCD
    p.push(K.part(K.G.boxc(), accent, K.M(0, 0.077, 0.0, 0, 0, 0, 0.12, 0.006, 0.16)));
    p.push(K.part(K.G.cylc(8), '#F2C230', K.M(0, 0.12, -0.02, Math.PI / 2, 0, 0, 0.09, 0.27, 0.09)));                     // tank
    p.push(K.part(K.G.cylc(6), '#2A2E33', K.M(0, 0.12, 0.13, Math.PI / 2, 0, 0, 0.03, 0.04, 0.03)));                      // valve
    p.push(K.part(K.G.boxc(), '#15191D', K.M(0, -0.04, 0.29, 0, 0, 0, 0.03, 0.03, 0.025)));                             // regulator
    p.push(K.part(K.G.cylc(5), '#15191D', K.M(0.05, 0.05, 0.22, 0.9, 0, 0.3, 0.012, 0.16, 0.012)));                       // hose
    for (const s of [-1, 1]) p.push(K.part(K.G.boxc(), suit, K.M(s * 0.07, -0.07, 0.08, 0, s * 0.6, 0, 0.045, 0.045, 0.16)));  // arms folded under chest
  }
  root.add(new THREE.Mesh(K.bake(p), mat));
  const legs = [];
  const finL = kind === 'free' ? 0.5 : 0.22, finW = kind === 'free' ? 0.1 : 0.14;
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.045, 0, -0.15);
    const lp = [K.part(K.G.boxc(), suit, K.M(0, 0, -0.15, 0, 0, 0, 0.06, 0.06, 0.3)),
                K.part(K.G.boxc(), opts.fin, K.M(0, -0.01, -0.3 - finL / 2, 0, 0, 0, finW, 0.012, finL)),
                K.part(K.G.boxc(), accent, K.M(0, -0.009, -0.3 - finL + 0.04, 0, 0, 0, finW, 0.014, 0.06))];
    piv.add(new THREE.Mesh(K.bake(lp), mat)); root.add(piv); legs.push({ piv, s });
  }
  return { root, legs, mouth: new THREE.Vector3(0, -0.04, 0.3) };
}

/* ------------------------------------------------------------------ swimming agent */
class Swimmer {
  constructor(o) {
    Object.assign(this, {
      speed: 0.4, turn: 0.6, depth: [-1.2, -0.4], clear: 0.35, sepR: 1.2, look: 1.6, pauseP: 0.25,
      margin: 1.0, yaw: 0, pitch: 0, pause: 0, t: 0, spd: 0, retarget: 0,
    }, o);
    this.pos = new THREE.Vector3(o.x, o.y ?? -0.6, o.z);
    this.tgt = new THREE.Vector3().copy(this.pos);
    this.tDepth = this.pos.y;
    this.pickTarget(true);
  }
  ok(x, z, m = this.margin) {
    const f = this.field;
    if (!f.inside(x, z, 3)) return false;
    if (f.sd(x, z) > -m) return false;
    const h = this.home; return Math.hypot(x - h.x, z - h.z) < h.r;
  }
  floor(x, z) { return this.field.h(x, z); }
  pickTarget(first) {
    const h = this.home, r = this.rnd;
    for (let k = 0; k < 40; k++) {
      const a = r() * TAU, d = Math.sqrt(r()) * h.r * 0.95;
      const x = h.x + Math.cos(a) * d, z = h.z + Math.sin(a) * d;
      if (!this.ok(x, z, this.margin + 0.4)) continue;
      const fl = this.floor(x, z);
      if (fl > this.depth[0] - this.clear + 0.6 && fl > -0.75) continue;   // too shallow
      this.tgt.set(x, 0, z);
      const lo = Math.max(this.depth[0], fl + this.clear), hi = this.depth[1];
      this.tDepth = lo < hi ? lo + r() * (hi - lo) : hi;
      if (first) { this.pos.x = x; this.pos.z = z; this.pos.y = this.tDepth; this.yaw = r() * TAU; }
      this.retarget = 12 + r() * 20;
      return;
    }
  }
  update(dt, others) {
    this.t += dt; this.retarget -= dt;
    const p = this.pos;
    if (this.pause > 0) this.pause -= dt;
    const want = this.pause > 0 ? this.speed * 0.18 : this.speed * (0.85 + 0.25 * Math.sin(this.t * 0.37 + this.seed));
    this.spd += (want - this.spd) * Math.min(1, dt * 0.8);
    let dx = this.tgt.x - p.x, dz = this.tgt.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.9 || this.retarget < 0) {
      if (this.rnd() < this.pauseP) this.pause = 2 + this.rnd() * 5;
      this.pickTarget(false); dx = this.tgt.x - p.x; dz = this.tgt.z - p.z;
    }
    let desired = Math.atan2(dx, dz);
    // separation
    for (const o of others) {
      if (o === this) continue;
      const ox = p.x - o.pos.x, oz = p.z - o.pos.z, d = Math.hypot(ox, oz), R = this.sepR + o.sepR * 0.5;
      if (d < R && d > 1e-3 && Math.abs(p.y - o.pos.y) < 0.9) desired = Math.atan2(Math.sin(desired) + ox / d * (R - d) * 1.5, Math.cos(desired) + oz / d * (R - d) * 1.5);
    }
    // land / boundary avoidance: probe ahead, steer to the clearer side
    const look = this.look + this.spd * 1.5;
    const ax = p.x + Math.sin(this.yaw) * look, az = p.z + Math.cos(this.yaw) * look;
    if (!this.ok(ax, az)) {
      let best = null;
      for (const off of [0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.4, -2.4, Math.PI]) {
        const a = this.yaw + off;
        if (this.ok(p.x + Math.sin(a) * look, p.z + Math.cos(a) * look)) { best = a; break; }
      }
      if (best !== null) desired = best;
      if (this.rnd() < 0.02) this.pickTarget(false);
    }
    const diff = wrapA(desired - this.yaw);
    const maxT = this.turn * dt;
    this.yaw += Math.max(-maxT, Math.min(maxT, diff));
    this.yawRate = Math.max(-maxT, Math.min(maxT, diff)) / Math.max(dt, 1e-4);
    const nx = p.x + Math.sin(this.yaw) * this.spd * dt, nz = p.z + Math.cos(this.yaw) * this.spd * dt;
    if (this.ok(nx, nz, this.margin * 0.6)) { p.x = nx; p.z = nz; }
    else { this.yaw += Math.PI * dt; this.pickTarget(false); }
    // depth
    const fl = this.floor(p.x, p.z);
    const lo = fl + this.clear;
    let ty = this.tDepth; if (ty < lo) ty = lo;
    const vy = (ty - p.y) * Math.min(1, dt * 0.6);
    p.y += vy; if (p.y < lo) p.y = lo; if (p.y > -0.06) p.y = -0.06;
    const wantP = Math.max(-0.45, Math.min(0.45, Math.atan2(vy / Math.max(dt, 1e-3), Math.max(0.2, this.spd)) * 0.6));
    this.pitch += (wantP - this.pitch) * Math.min(1, dt * 2);
  }
}

/* ------------------------------------------------------------------ people */
const SKIN = { light: '#F2CDAE', lightmed: '#E3B28C', med: '#C98F66', tan: '#B47B52', deep: '#8A5636', dark: '#6B4128' };

// 11 adult travel companions + 5 adult Cebu locals. Fixed identities.
export const PEOPLE = [
  { id: 'c01', group: 'companion', zone: 'alona', name: '旅伴 01', desc: '湖水綠背心、海軍藍運動短褲（白側條）、反戴紅色棒球帽',
    skin: SKIN.tan, build: 1.0, hair: ['short', '#1E1A17'], top: ['tank', '#2E9C95'], bottom: ['shorts', '#24324A', 0.12, '#FFFFFF'], hat: ['capBack', '#C9433A'], feet: '#2A2A2A', speed: 0.5 },
  { id: 'c02', group: 'companion', zone: 'alona', name: '旅伴 02', desc: '赤膊、橘色海灘褲、黑色太陽眼鏡、平頭',
    skin: SKIN.deep, build: 1.08, hair: ['buzz', '#191512'], top: ['none'], bottom: ['shorts', '#E8803F', 0.14, '#F6D66B'], glasses: '#111', feet: '#3B6EA8', speed: 0.42 },
  { id: 'c03', group: 'companion', zone: 'moalboal', name: '旅伴 03', desc: '泳者：寶藍三角泳褲、蛙鏡戴在額頭、肩披白藍條紋毛巾、彩虹手環',
    skin: SKIN.light, build: 0.94, hair: ['short', '#6A4A30'], top: ['none'], bottom: ['brief', '#1E55B8'], goggles: '#2FA3D6', towel: ['#FFFFFF', '#3B7BD0'], rainbowBand: true, feet: null, speed: 0.55 },
  { id: 'c04', group: 'companion', zone: 'oslob', name: '旅伴 04', desc: '健美體型：黑色緊身背心、合身灰短褲、光頭、太陽眼鏡',
    skin: SKIN.med, build: 1.38, hair: ['none'], top: ['tank', '#1D1F22'], bottom: ['shorts', '#8B9097', 0.1], glasses: '#111', feet: '#1D1F22', speed: 0.38 },
  { id: 'c05', group: 'companion', zone: 'cebu', name: '旅伴 05', desc: '天藍花襯衫（粉、黃花朵）、白色合身短褲、草編紳士帽、棕色斜背包',
    skin: SKIN.light, build: 1.0, hair: ['wavy', '#14110F'], top: ['shirt', '#7EC3E6', 'floral'], bottom: ['shorts', '#F4F1EA', 0.1], hat: ['straw', '#D9BE84'], crossbody: '#8A5A34', feet: '#A0754D', speed: 0.46 },
  { id: 'c06', group: 'companion', zone: 'alona', name: '旅伴 06', desc: '白 T 恤、芥末黃合身短褲、橄欖綠漁夫帽、黑色斜背包、圓框墨鏡',
    skin: SKIN.lightmed, build: 0.98, hair: ['short', '#2B201A'], top: ['tee', '#F7F6F2'], bottom: ['shorts', '#D9A928', 0.1], hat: ['bucket', '#6E7A3E'], crossbody: '#1F1F1F', glasses: '#3A2A1A', feet: '#E9E4D8', speed: 0.48 },
  { id: 'c07', group: 'companion', zone: 'moalboal', name: '旅伴 07', desc: '沙色亞麻襯衫、湖綠反摺短褲、捲髮與落腮鬍、夾腳拖',
    skin: SKIN.dark, build: 1.04, hair: ['curly', '#1A1411'], beard: '#1A1411', top: ['shirt', '#E2D2B0'], bottom: ['shorts', '#3E9C93', 0.12], feet: '#C9573F', speed: 0.4 },
  { id: 'c08', group: 'companion', zone: 'cebu', name: '旅伴 08', desc: '白背心配彩虹滾邊、牛仔短褲、漂染金髮',
    skin: SKIN.lightmed, build: 0.96, hair: ['short', '#E3C27A'], top: ['tank', '#FAFAF7'], rainbowTrim: true, bottom: ['shorts', '#4E72A6', 0.1], feet: '#F4F1EA', speed: 0.52 },
  { id: 'c09', group: 'companion', zone: 'oslob', name: '旅伴 09', desc: '萊姆綠無袖運動衫、黑色緊身運動短褲、頭帶、刺蝟頭',
    skin: SKIN.light, build: 0.9, hair: ['spiky', '#15120F'], top: ['tank', '#A6D33B'], bottom: ['shorts', '#18191B', 0.13], hat: ['headband', '#F7F7F2'], feet: '#E8E8E8', speed: 0.6 },
  { id: 'c10', group: 'companion', zone: 'alona', name: '旅伴 10', desc: '熊系壯碩身形、赤膊、紅色泳褲、海軍藍棒球帽、灰黑落腮鬍',
    skin: SKIN.tan, build: 1.3, belly: true, hair: ['short', '#3A3532'], beard: '#4A4542', top: ['none'], bottom: ['shorts', '#C7372F', 0.08], hat: ['cap', '#22324F'], feet: '#2A2A2A', speed: 0.36 },
  { id: 'c11', group: 'companion', zone: 'moalboal', name: '旅伴 11', desc: '珊瑚色長袖防曬衣、海軍藍衝浪褲、寬邊草帽、太陽眼鏡',
    skin: SKIN.med, build: 1.0, hair: ['short', '#1B1714'], top: ['rash', '#EF7F6A'], bottom: ['shorts', '#22324F', 0.15], hat: ['straw', '#E3CB94'], glasses: '#111', feet: null, speed: 0.44 },
  { id: 'l01', group: 'local', zone: 'alona', name: '在地人 01', desc: '黃色碎花洋裝、黑色長馬尾、粉紅陽傘、拖鞋',
    skin: SKIN.med, build: 0.9, female: true, hair: ['ponytail', '#0F0D0C'], top: ['dress', '#F3C94B', 'floral'], bottom: ['skirt', '#F3C94B'], parasol: '#EE8FA8', feet: '#7A4A30', speed: 0.34 },
  { id: 'l02', group: 'local', zone: 'cebu', name: '在地人 02', desc: '藍白籃球背心與球褲、短髮、運動拖鞋',
    skin: SKIN.tan, build: 1.0, hair: ['short', '#0F0D0C'], top: ['jersey', '#2B5DB8', '#FFFFFF'], bottom: ['shorts', '#2B5DB8', 0.15, '#FFFFFF'], feet: '#111', speed: 0.5 },
  { id: 'l03', group: 'local', zone: 'oslob', name: '在地人 03', desc: '年長男性：酒紅 polo 衫、卡其長褲、白髮',
    skin: SKIN.deep, build: 0.98, hair: ['short', '#E6E3DD'], top: ['tee', '#8C2F3B'], bottom: ['pants', '#C8B48A'], feet: '#4A3A2C', speed: 0.3 },
  { id: 'l04', group: 'local', zone: 'moalboal', name: '在地人 04', desc: '綠色 T 恤、深色七分褲、鮑伯短髮、帆布托特包',
    skin: SKIN.med, build: 0.9, female: true, hair: ['bob', '#151110'], top: ['tee', '#4E9A5C'], bottom: ['capri', '#2F3440'], tote: '#E7DDC7', feet: '#B9A07A', speed: 0.38 },
  { id: 'l05', group: 'local', zone: 'cebu', name: '在地人 05', desc: '灰色素 T、深色牛仔短褲、黃色棒球帽、後背包',
    skin: SKIN.tan, build: 0.96, hair: ['short', '#0F0D0C'], top: ['tee', '#9AA0A6'], bottom: ['shorts', '#2E3A52', 0.12], hat: ['cap', '#F2C230'], backpack: '#3E5F7A', feet: '#222', speed: 0.55 },
];

const RAINBOW = ['#E40303', '#FF8C00', '#FFED00', '#008026', '#004CFF', '#732982'];

function buildPerson(c, mat) {
  const b = c.build || 1, fem = !!c.female;
  const TW = 0.16 * (b > 1.2 ? b * 0.98 : b), TD = 0.095 * (b > 1.2 ? 1.12 : 1), TH = 0.2;
  const hipY = 0.27, shY = hipY + TH;
  const skin = c.skin;
  const root = new THREE.Group();
  const T = [];   // torso + head (static)
  const top = c.top[0], topCol = c.top[1];
  const torsoCol = (top === 'none' || top === 'brief') ? skin : topCol;
  T.push(K.part(K.G.box(), torsoCol, K.M(0, hipY, 0, 0, 0, 0, TW, TH, TD)));
  if (c.belly) T.push(K.part(K.G.ico(0), skin, K.M(0, hipY + 0.06, 0.04, 0, 0, 0, TW * 0.85, 0.12, 0.08)));
  if (top === 'tank') { // bare shoulders: skin strip on top + tank colour
    T.push(K.part(K.G.box(), skin, K.M(0, shY - 0.03, 0, 0, 0, 0, TW * 1.001, 0.03, TD * 1.001)));
    for (const s of [-1, 1]) T.push(K.part(K.G.box(), topCol, K.M(s * TW * 0.25, shY - 0.03, 0, 0, 0, 0, TW * 0.16, 0.031, TD * 1.01)));
  }
  if (top === 'jersey') {
    T.push(K.part(K.G.box(), skin, K.M(0, shY - 0.03, 0, 0, 0, 0, TW * 1.001, 0.03, TD * 1.001)));
    for (const s of [-1, 1]) T.push(K.part(K.G.box(), topCol, K.M(s * TW * 0.25, shY - 0.03, 0, 0, 0, 0, TW * 0.16, 0.031, TD * 1.01)));
    T.push(K.part(K.G.box(), c.top[2], K.M(0, hipY + 0.11, TD / 2 + 0.003, 0, 0, 0, 0.05, 0.04, 0.004)));
  }
  if (top === 'shirt') T.push(K.part(K.G.box(), '#FFFFFF', K.M(0, hipY + 0.02, TD / 2 + 0.002, 0, 0, 0, 0.008, TH - 0.04, 0.003)));
  if (c.top[2] === 'floral') {
    const fc = ['#F07CA8', '#F7D54A', '#FFFFFF', '#F59A4C'];
    for (let i = 0; i < 14; i++) {
      const face = i % 2 ? 1 : -1, fx = ((i * 37) % 10 / 10 - 0.5) * TW * 0.8, fy = hipY + 0.03 + ((i * 53) % 10 / 10) * (TH - 0.05);
      T.push(K.part(K.G.boxc(), fc[i % 4], K.M(fx, fy, face * (TD / 2 + 0.002), 0, 0, 0.6, 0.022, 0.022, 0.004)));
    }
  }
  if (c.rainbowTrim) RAINBOW.forEach((rc, i) => T.push(K.part(K.G.box(), rc, K.M(0, hipY + 0.005 + i * 0.008, 0, 0, 0, 0, TW * 1.02, 0.008, TD * 1.02))));
  if (top === 'dress' || c.bottom[0] === 'skirt') {
    const sk = new THREE.CylinderGeometry(TW * 0.55, TW * 0.82, 0.15, 8).translate(0, -0.075, 0);
    T.push(K.part(sk, c.bottom[1], K.M(0, hipY + 0.02, 0, 0, 0, 0, 1, 1, TD / TW * 1.3)));
  }
  if (c.bottom[0] === 'brief') T.push(K.part(K.G.box(), c.bottom[1], K.M(0, hipY - 0.03, 0, 0, 0, 0, TW * 1.02, 0.06, TD * 1.04)));
  else if (c.bottom[0] !== 'skirt') T.push(K.part(K.G.box(), c.bottom[1], K.M(0, hipY - 0.025, 0, 0, 0, 0, TW * 1.02, 0.05, TD * 1.04)));
  // neck + head
  T.push(K.part(K.G.cyl(6), skin, K.M(0, shY, 0, 0, 0, 0, 0.045, 0.03, 0.045)));
  const hy = shY + 0.085;
  T.push(K.part(K.G.ico(1), skin, K.M(0, hy, 0, 0, 0, 0, 0.13, 0.14, 0.13)));
  // face
  if (c.glasses) T.push(K.part(K.G.boxc(), c.glasses, K.M(0, hy + 0.012, 0.062, 0, 0, 0, 0.11, 0.026, 0.012)));
  else for (const s of [-1, 1]) T.push(K.part(K.G.boxc(), '#231A15', K.M(s * 0.026, hy + 0.012, 0.064, 0, 0, 0, 0.016, 0.016, 0.006)));
  if (c.beard) T.push(K.part(K.G.ico(0), c.beard, K.M(0, hy - 0.04, 0.035, 0, 0, 0, 0.11, 0.06, 0.08)));
  if (c.goggles) {
    T.push(K.part(K.G.cylc(10), '#20262C', K.M(0, hy + 0.045, 0, 0, 0, 0, 0.138, 0.012, 0.138)));
    for (const s of [-1, 1]) T.push(K.part(K.G.boxc(), c.goggles, K.M(s * 0.025, hy + 0.05, 0.066, 0, 0, 0, 0.032, 0.022, 0.01)));
  }
  // hair
  const [hs, hc] = c.hair;
  if (hs === 'short' || hs === 'wavy') T.push(K.part(K.G.ico(1), hc, K.M(0, hy + 0.03, -0.008, 0, 0, 0, 0.142, 0.1, 0.145)));
  if (hs === 'wavy') for (const s of [-1, 1]) T.push(K.part(K.G.ico(0), hc, K.M(s * 0.05, hy + 0.055, 0.02, 0, 0, 0, 0.06, 0.05, 0.08)));
  if (hs === 'buzz') T.push(K.part(K.G.ico(1), hc, K.M(0, hy + 0.012, -0.004, 0, 0, 0, 0.134, 0.12, 0.136)));
  if (hs === 'curly') for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; T.push(K.part(K.G.ico(0), hc, K.M(Math.cos(a) * 0.045, hy + 0.06 + (i % 2) * 0.01, Math.sin(a) * 0.045 - 0.01, 0, a, 0, 0.065, 0.06, 0.065))); }
  if (hs === 'spiky') for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; T.push(K.part(K.G.cone(4), hc, K.M(Math.cos(a) * 0.035, hy + 0.04, Math.sin(a) * 0.035, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5, 0.04, 0.07, 0.04))); }
  if (hs === 'ponytail') { T.push(K.part(K.G.ico(1), hc, K.M(0, hy + 0.025, -0.01, 0, 0, 0, 0.144, 0.11, 0.148))); T.push(K.part(K.G.cylc(5), hc, K.M(0, hy - 0.03, -0.085, 0.5, 0, 0, 0.035, 0.13, 0.035))); }
  if (hs === 'bob') { T.push(K.part(K.G.ico(1), hc, K.M(0, hy + 0.01, -0.01, 0, 0, 0, 0.152, 0.14, 0.152))); }
  // hats
  if (c.hat) {
    const [ht, hcol] = c.hat;
    if (ht === 'cap' || ht === 'capBack') {
      T.push(K.part(K.G.ico(1), hcol, K.M(0, hy + 0.045, 0, 0, 0, 0, 0.146, 0.09, 0.148)));
      T.push(K.part(K.G.boxc(), hcol, K.M(0, hy + 0.045, ht === 'cap' ? 0.085 : -0.085, 0, 0, 0, 0.1, 0.01, 0.07)));
    }
    if (ht === 'bucket') { T.push(K.part(K.G.cyl(8), hcol, K.M(0, hy + 0.035, 0, 0, 0, 0, 0.13, 0.06, 0.13))); T.push(K.part(K.G.cyl(10), hcol, K.M(0, hy + 0.03, 0, 0, 0, 0, 0.2, 0.01, 0.2))); }
    if (ht === 'straw') { T.push(K.part(K.G.cyl(10), hcol, K.M(0, hy + 0.045, 0, 0, 0, 0, 0.12, 0.05, 0.12))); T.push(K.part(K.G.cyl(12), hcol, K.M(0, hy + 0.04, 0, 0, 0, 0, 0.27, 0.01, 0.27))); T.push(K.part(K.G.cyl(10), '#5A3D2B', K.M(0, hy + 0.05, 0, 0, 0, 0, 0.124, 0.012, 0.124))); }
    if (ht === 'headband') T.push(K.part(K.G.cyl(10), hcol, K.M(0, hy + 0.04, 0, 0, 0, 0, 0.138, 0.02, 0.138)));
  }
  // carried items on torso
  if (c.crossbody) {
    T.push(K.part(K.G.boxc(), c.crossbody, K.M(0, hipY + TH * 0.55, TD / 2 + 0.004, 0, 0, 0.75, 0.012, 0.27, 0.004)));
    T.push(K.part(K.G.boxc(), c.crossbody, K.M(TW * 0.45, hipY + 0.02, TD / 2 + 0.02, 0, 0, 0, 0.06, 0.05, 0.03)));
  }
  if (c.towel) { T.push(K.part(K.G.boxc(), c.towel[0], K.M(-TW * 0.32, shY - 0.02, 0, 0, 0, 0, 0.05, 0.03, TD + 0.03))); T.push(K.part(K.G.boxc(), c.towel[1], K.M(-TW * 0.32, shY - 0.06, TD / 2 + 0.012, 0, 0, 0, 0.05, 0.1, 0.008))); }
  if (c.backpack) T.push(K.part(K.G.boxc(), c.backpack, K.M(0, hipY + 0.11, -TD / 2 - 0.035, 0, 0, 0, TW * 0.8, 0.14, 0.06)));
  const torso = new THREE.Mesh(K.bake(T), mat); root.add(torso);

  // limbs
  const armW = 0.048 * (b > 1.2 ? 1.45 : b), armL = 0.21;
  const sleeve = top === 'tee' || top === 'shirt' ? 0.08 : top === 'rash' ? armL : 0;
  const arms = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * (TW / 2 + armW / 2 + 0.003), shY - 0.02, 0);
    const A = [K.part(K.G.box(), skin, K.M(0, -armL, 0, 0, 0, 0, armW, armL, armW))];
    if (sleeve) A.push(K.part(K.G.box(), topCol, K.M(0, -sleeve, 0, 0, 0, 0, armW * 1.12, sleeve + 0.005, armW * 1.12)));
    if (c.rainbowBand && s < 0) RAINBOW.forEach((rc, i) => A.push(K.part(K.G.box(), rc, K.M(0, -armL + 0.03 + i * 0.006, 0, 0, 0, 0, armW * 1.15, 0.006, armW * 1.15))));
    if (c.tote && s > 0) { A.push(K.part(K.G.boxc(), c.tote, K.M(0, -armL - 0.06, 0, 0, 0, 0, 0.03, 0.1, 0.11))); }
    if (c.parasol && s > 0) {
      A.push(K.part(K.G.cyl(4), '#EDE7DC', K.M(0, -armL - 0.01, 0.02, 0, 0, 0, 0.012, 0.42, 0.012)));
      A.push(K.part(K.G.cone(8), c.parasol, K.M(0, -armL + 0.36, 0.02, 0, 0, 0, 0.38, 0.1, 0.38)));
    }
    const m = new THREE.Mesh(K.bake(A), mat); piv.add(m); root.add(piv); arms.push(piv);
  }
  const legs = [];
  const legW = 0.064 * (b > 1.2 ? 1.25 : 1);
  const bl = c.bottom[0], cover = bl === 'shorts' ? (c.bottom[2] || 0.12) : bl === 'pants' ? 0.27 : bl === 'capri' ? 0.2 : 0;
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * TW * 0.27, hipY, 0);
    const L = [K.part(K.G.box(), skin, K.M(0, -hipY, 0, 0, 0, 0, legW, hipY, legW))];
    if (cover) {
      L.push(K.part(K.G.box(), c.bottom[1], K.M(0, -cover, 0, 0, 0, 0, legW * 1.15, cover + 0.004, legW * 1.15)));
      if (c.bottom[3]) L.push(K.part(K.G.box(), c.bottom[3], K.M(s * legW * 0.58, -cover, 0, 0, 0, 0, 0.006, cover, legW * 0.5)));
    }
    if (c.feet) L.push(K.part(K.G.box(), c.feet, K.M(0, -hipY, 0.015, 0, 0, 0, legW * 1.1, 0.014, legW * 1.6)));
    const m = new THREE.Mesh(K.bake(L), mat); piv.add(m); root.add(piv); legs.push(piv);
  }
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  root.scale.setScalar(0.7);
  return { root, arms, legs };
}

/* ------------------------------------------------------------------ main builder */
export function buildLife(ctx) {
  const { scene, field, obst, tier, geo } = ctx;
  const rnd = mulberry32(81231);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, flatShading: true });
  const out = { swimmers: [], people: [], list: [] };
  const P = (k) => geo.places[k];
  const homeNear = (key, sdTarget, r) => { const [x, z] = P(key); const [hx, hz] = field.seek(x, z, sdTarget); return { x: hx, z: hz, r }; };

  /* ---- marine ---- */
  const sharkHome = homeNear('whaleshark', -3.2, 3.6);
  const shark = buildWhaleShark(rnd, mat); shark.root.scale.setScalar(1.0); scene.add(shark.root);
  const sA = new Swimmer({ field, rnd, seed: 1, home: sharkHome, x: sharkHome.x, z: sharkHome.z, speed: 0.42, turn: 0.22, depth: [-0.95, -0.42], clear: 0.5, sepR: 1.6, look: 3.0, pauseP: 0.1, margin: 1.4 });
  out.swimmers.push({ a: sA, kind: 'whaleshark', obj: shark.root, anim: (t, a) => {
    const w = Math.sin(t * 1.25);
    shark.tail.rotation.y = w * 0.38; shark.body.rotation.y = -w * 0.06 + a.yawRate * -0.4;
  } });

  // sardine ball
  const sardHome = homeNear('panagsama', -2.6, 2.4);
  const nFish = tier === 'low' ? 220 : tier === 'mid' ? 420 : 680;
  const fishGeo = K.bake([
    K.part(new THREE.ConeGeometry(0.03, 0.15, 4).rotateX(Math.PI / 2), '#C9D6DE', null),
    K.part(new THREE.BoxGeometry(0.012, 0.022, 0.1).translate(0, 0.014, -0.005), '#3E5E78', null),
    K.part(new THREE.ConeGeometry(0.025, 0.04, 3).rotateX(-Math.PI / 2).translate(0, 0, -0.09), '#9FB2BE', null)]);
  const fishMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.45, flatShading: true });
  const fish = new THREE.InstancedMesh(fishGeo, fishMat, nFish); fish.frustumCulled = false; scene.add(fish);
  const F = [];
  for (let i = 0; i < nFish; i++) F.push({ r: 0.38 + Math.pow(rnd(), 0.7) * 0.62, w: (0.55 + rnd() * 0.5) * (rnd() < 0.93 ? 1 : -1), p: rnd() * TAU, y: (rnd() - 0.5) * 1.3, q: rnd() * TAU, tilt: (rnd() - 0.5) * 0.7 });
  const ball = new Swimmer({ field, rnd, seed: 2, home: sardHome, x: sardHome.x, z: sardHome.z, speed: 0.18, turn: 0.35, depth: [-1.3, -0.75], clear: 0.65, sepR: 1.4, look: 2.0, pauseP: 0.4, margin: 1.4 });
  const fd = new THREE.Object3D(), tmpV = new THREE.Vector3();
  out.swimmers.push({ a: ball, kind: 'sardines', obj: null, anim: (t, a) => {
    const R = 1.05 + Math.sin(t * 0.21) * 0.15;
    const sx = 1 + Math.sin(t * 0.33) * 0.22, sy = 0.62 + Math.sin(t * 0.41 + 1) * 0.12, sz = 1 - Math.sin(t * 0.33) * 0.18;
    const bulgeA = t * 0.5, push = Math.sin(t * 0.9) * 0.35;           // a travelling dent / bulge → not a solid ball
    for (let i = 0; i < nFish; i++) {
      const f = F[i];
      const th = f.p + f.w * t;
      const dA = wrapA(th - bulgeA);
      const local = 1 + 0.14 * Math.sin(t * 1.1 + f.q) + push * Math.exp(-dA * dA * 2.5);
      const rr = f.r * R * local;
      const yy = (f.y + Math.sin(t * 0.8 + f.q) * 0.12) * R * sy;
      const x = Math.cos(th) * rr * sx, z = Math.sin(th) * rr * sz;
      fd.position.set(a.pos.x + x, a.pos.y + yy, a.pos.z + z);
      const dir = f.w > 0 ? 1 : -1;
      tmpV.set(-Math.sin(th) * dir * sx, Math.cos(t * 0.8 + f.q) * 0.08, Math.cos(th) * dir * sz);
      fd.rotation.set(f.tilt * 0.3, Math.atan2(tmpV.x, tmpV.z), Math.sin(t * 6 + f.q) * 0.2);
      fd.updateMatrix(); fish.setMatrixAt(i, fd.matrix);
    }
    fish.instanceMatrix.needsUpdate = true;
  } });

  // turtles
  const turtleHomes = [homeNear('panagsama', -1.6, 3.0), homeNear('balicasag', -1.8, 2.6), homeNear('alona', -2.0, 3.2)];
  turtleHomes.forEach((h, i) => {
    const tt = buildTurtle(rnd, mat); tt.root.scale.setScalar(0.8); scene.add(tt.root);
    const a = new Swimmer({ field, rnd, seed: 10 + i, home: h, x: h.x, z: h.z, speed: 0.22 + rnd() * 0.06, turn: 0.55, depth: [-1.15, -0.35], clear: 0.32, sepR: 0.8, look: 1.2, pauseP: 0.35, margin: 0.9 });
    a.breath = 20 + rnd() * 30;
    out.swimmers.push({ a, kind: 'turtle', obj: tt.root, anim: (t, ag, dt) => {
      const k = Math.sin(t * 1.6 + i);
      for (const f of tt.flips) { f.piv.rotation.z = f.s * (0.05 + k * 0.32); f.piv.rotation.y = f.s * (0.1 - k * 0.3); }
      ag.breath -= dt; if (ag.breath < 0) { ag.tDepth = -0.12; if (ag.breath < -6) { ag.breath = 25 + rnd() * 35; ag.pickTarget(false); } }
    } });
  });

  // divers
  const divers = [
    { kind: 'free', home: homeNear('panagsama', -2.2, 3.4), o: { suit: '#1F2A33', accent: '#2FA3D6', skin: SKIN.med, fin: '#1C2228' } },
    { kind: 'free', home: homeNear('panagsama', -2.8, 3.6), o: { suit: '#2D2F3A', accent: '#E8673A', skin: SKIN.lightmed, fin: '#2B5DB8' } },
    { kind: 'scuba', home: homeNear('balicasag', -2.6, 2.6), o: { suit: '#1B2026', accent: '#F2C230', skin: SKIN.light, fin: '#F2C230' } },
    { kind: 'scuba', home: homeNear('panagsama', -3.4, 3.0), o: { suit: '#21313F', accent: '#E04F5F', skin: SKIN.tan, fin: '#2A2E33' } },
  ];
  const bubbleN = 60;
  const bubbles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.022, 0), new THREE.MeshStandardMaterial({ color: '#F2FBFF', transparent: true, opacity: 0.75, roughness: 0.1 }), bubbleN);
  bubbles.frustumCulled = false; scene.add(bubbles);
  const B = []; for (let i = 0; i < bubbleN; i++) B.push({ on: false, x: 0, y: -9, z: 0, v: 0, ph: rnd() * 6 });
  let bi = 0;
  divers.forEach((d, i) => {
    const dv = buildDiver(d.kind, d.o, mat); dv.root.scale.setScalar(1.25); scene.add(dv.root);
    const free = d.kind === 'free';
    const a = new Swimmer({ field, rnd, seed: 20 + i, home: d.home, x: d.home.x, z: d.home.z, speed: free ? 0.3 : 0.16, turn: free ? 0.6 : 0.45,
      depth: free ? [-1.6, -0.5] : [-1.45, -0.8], clear: 0.4, sepR: 0.9, look: 1.3, pauseP: free ? 0.2 : 0.45, margin: 0.9 });
    a.cycle = free ? rnd() * 20 : 0; a.exhale = rnd() * 3;
    out.swimmers.push({ a, kind: free ? 'freediver' : 'scuba', obj: dv.root, anim: (t, ag, dt) => {
      if (free) {
        // breathe-up at the surface, dive, glide, ascend
        ag.cycle += dt; const c = ag.cycle % 34;
        if (c < 9) { ag.tDepth = -0.08; ag.speed = 0.12; }
        else if (c < 24) { ag.tDepth = Math.max(-1.6, field.h(ag.pos.x, ag.pos.z) + 0.45); ag.speed = 0.32; }
        else { ag.tDepth = -0.08; ag.speed = 0.28; }
        const k = Math.sin(t * 2.4 + i) * (c < 9 ? 0.15 : 0.32);
        for (const l of dv.legs) l.piv.rotation.x = k;
      } else {
        const k = Math.sin(t * 2.2 + i);
        for (const l of dv.legs) l.piv.rotation.x = l.s * k * 0.35;
        ag.exhale -= dt;
        if (ag.exhale < 0) {
          ag.exhale = 3 + rnd() * 1.5;
          const m = dv.mouth.clone().applyMatrix4(dv.root.matrixWorld);
          for (let q = 0; q < 6; q++) { const bb = B[bi]; bi = (bi + 1) % bubbleN; bb.on = true; bb.x = m.x + (rnd() - 0.5) * 0.05; bb.y = m.y - q * 0.04; bb.z = m.z + (rnd() - 0.5) * 0.05; bb.v = 0.35 + rnd() * 0.3; bb.s = 0.6 + rnd() * 0.9; }
        }
      }
    } });
  });
  const bd = new THREE.Object3D();
  out.updateBubbles = (dt, t) => {
    for (let i = 0; i < bubbleN; i++) {
      const b = B[i];
      if (b.on) { b.y += b.v * dt; b.x += Math.sin(t * 3 + b.ph) * 0.004; if (b.y > -0.02) b.on = false; }
      bd.position.set(b.x, b.on ? b.y : -50, b.z); bd.scale.setScalar(b.on ? b.s : 0.001); bd.updateMatrix(); bubbles.setMatrixAt(i, bd.matrix);
    }
    bubbles.instanceMatrix.needsUpdate = true;
  };

  /* ---- people ---- */
  const ZONES = {
    alona:    { key: 'alona',     r: 3.4, smax: 1.15, label: '邦勞島 Alona 海灘' },
    moalboal: { key: 'panagsama', r: 3.0, smax: 1.1, label: '墨寶 Panagsama 海灘' },
    oslob:    { key: 'quartel',   r: 3.0, smax: 1.1, label: '奧斯陸 Quartel 海灘' },
    cebu:     { key: 'cebuwalk',  r: 2.6, smax: 1.3, label: '宿霧市區 海濱' },
  };
  const walkable = (x, z, zone, rad = 0.13) => {
    const s = field.sd(x, z);
    if (s < 0.2 || s > zone.smax) return false;
    if (Math.hypot(x - zone.cx, z - zone.cz) > zone.r) return false;
    if (field.h(x, z) > 0.62) return false;
    return !obst.hit(x, z, rad);
  };
  for (const k in ZONES) {
    const z = ZONES[k]; const [x0, z0] = P(z.key); const [cx, cz] = field.seek(x0, z0, 0.55); z.cx = cx; z.cz = cz;
    z.pts = [];
    for (let i = 0; i < 2500 && z.pts.length < 260; i++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * z.r, x = cx + Math.cos(a) * d, zz = cz + Math.sin(a) * d;
      if (walkable(x, zz, z, 0.16)) z.pts.push([x, zz]);
    }
  }
  out.zones = ZONES;
  const segClear = (x1, z1, x2, z2, zone) => {
    const L = Math.hypot(x2 - x1, z2 - z1), n = Math.ceil(L / 0.12);
    for (let i = 1; i <= n; i++) { const t = i / n; if (!walkable(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, zone)) return false; }
    return true;
  };
  const used = [];
  PEOPLE.forEach((c, i) => {
    const zone = ZONES[c.zone];
    const pp = buildPerson(c, mat); scene.add(pp.root);
    let st = null;
    for (let k = 0; k < 200 && !st; k++) {
      const p = zone.pts[(rnd() * zone.pts.length) | 0]; if (!p) break;
      if (used.every(u => Math.hypot(u[0] - p[0], u[1] - p[1]) > 0.5)) st = p;
    }
    if (!st) st = zone.pts[0] || [zone.cx, zone.cz];
    used.push(st);
    const person = { c, zone, ...pp, x: st[0], z: st[1], yaw: rnd() * TAU, state: 'idle', timer: 1 + rnd() * 3, tx: st[0], tz: st[1], phase: rnd() * TAU, speed: c.speed * 0.55 * (0.9 + rnd() * 0.2), wave: 0, seed: rnd() };
    out.people.push(person);
    out.list.push({ id: c.id, group: c.group, name: c.name, desc: c.desc, zone: zone.label });
  });
  const seaYaw = (x, z) => { const [gx, gz] = field.grad(x, z); return Math.atan2(-gx, -gz); };
  const minGap = 0.3;
  function stepPerson(p, dt) {
    p.timer -= dt;
    if (p.state === 'walk') {
      const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
      if (d < 0.08) { p.state = 'idle'; p.timer = 1.5 + rnd() * 4; }
      else {
        const want = Math.atan2(dx, dz); const df = wrapA(want - p.yaw); p.yaw += Math.max(-3 * dt, Math.min(3 * dt, df));
        const v = Math.abs(df) > 0.8 ? 0.15 : 1;
        const nx = p.x + Math.sin(p.yaw) * p.speed * v * dt, nz = p.z + Math.cos(p.yaw) * p.speed * v * dt;
        let blocked = !walkable(nx, nz, p.zone, 0.1);
        if (!blocked) for (const o of out.people) {
          if (o === p) continue;
          const g2 = Math.hypot(nx - o.x, nz - o.z);
          if (g2 < minGap && g2 < Math.hypot(p.x - o.x, p.z - o.z)) { blocked = true; break; }
        }
        if (blocked) { p.state = 'idle'; p.timer = 0.6 + rnd() * 1.4; p.blocked = (p.blocked || 0) + 1; }
        else { p.x = nx; p.z = nz; p.blocked = 0; p.phase += dt * p.speed * 34; }
        if (p.timer < -25) { p.state = 'idle'; p.timer = 1; }
      }
    } else if (p.timer <= 0) {
      const r = rnd();
      if (r < 0.58) {                                // walk somewhere new (clear straight path only)
        for (let k = 0; k < 14; k++) {
          const q = p.zone.pts[(rnd() * p.zone.pts.length) | 0]; if (!q) break;
          const d = Math.hypot(q[0] - p.x, q[1] - p.z);
          if (d < 0.5 || d > 2.4) continue;
          if (segClear(p.x, p.z, q[0], q[1], p.zone)) { p.tx = q[0]; p.tz = q[1]; p.state = 'walk'; p.timer = 30; break; }
        }
        if (p.state !== 'walk') p.timer = 0.8;
      } else if (r < 0.8) { p.state = 'sea'; p.timer = 3 + rnd() * 4; p.syaw = seaYaw(p.x, p.z); }   // look at the sea
      else if (r < 0.92) { p.state = 'wave'; p.timer = 2 + rnd() * 1.5; }
      else { p.state = 'idle'; p.timer = 2 + rnd() * 3; }
    }
    if (p.state === 'sea') { const df = wrapA(p.syaw - p.yaw); p.yaw += Math.max(-2 * dt, Math.min(2 * dt, df)); if (p.timer <= 0) { p.state = 'idle'; p.timer = 0.5; } }
    if (p.state === 'wave' && p.timer <= 0) { p.state = 'idle'; p.timer = 1 + rnd() * 2; }
  }
  function posePerson(p, t) {
    const walk = p.state === 'walk', s = walk ? Math.sin(p.phase) : 0;
    p.legs[0].rotation.x = s * 0.55; p.legs[1].rotation.x = -s * 0.55;
    const holds = p.c.parasol;
    p.arms[0].rotation.x = -s * 0.45; p.arms[0].rotation.z = 0;
    p.arms[1].rotation.x = holds ? -0.5 : s * 0.45; p.arms[1].rotation.z = 0;
    p.wave += ((p.state === 'wave' ? 1 : 0) - p.wave) * 0.12;
    if (p.wave > 0.01 && !holds) { p.arms[1].rotation.z = p.wave * 2.55 + Math.sin(t * 9) * 0.25 * p.wave; p.arms[1].rotation.x = 0; }
    const y = field.h(p.x, p.z);
    p.root.position.set(p.x, y + (walk ? Math.abs(Math.sin(p.phase)) * 0.012 : Math.sin(t * 1.5 + p.seed * 6) * 0.002), p.z);
    p.root.rotation.y = p.yaw;
  }
  out.people.forEach(p => posePerson(p, 0));

  /* ---- update ---- */
  let frame = 0;
  out.update = (dt, t, cam, target) => {
    frame++;
    const all = out.swimmers.map(s => s.a);
    for (const s of out.swimmers) {
      const a = s.a;
      const far = Math.hypot(a.pos.x - target.x, a.pos.z - target.z) > 45;
      a.acc = (a.acc || 0) + dt;
      if (far && (frame + a.seed) % 3) continue;                       // distant: update every 3rd frame
      const sdt = Math.min(0.12, a.acc); a.acc = 0;
      a.update(sdt, all);
      s.anim(t, a, sdt);
      if (s.obj) { s.obj.position.copy(a.pos); s.obj.rotation.set(-a.pitch, a.yaw, 0, 'YXZ'); }
    }
    out.updateBubbles(dt, t);
    for (const p of out.people) {
      const far = Math.hypot(p.x - target.x, p.z - target.z) > 40;
      p.acc = (p.acc || 0) + dt;
      if (far && (frame + (p.seed * 7 | 0)) % 4) continue;
      const pdt = Math.min(0.15, p.acc); p.acc = 0;
      stepPerson(p, pdt); posePerson(p, t);
    }
  };
  out.counts = () => ({
    whaleshark: out.swimmers.filter(s => s.kind === 'whaleshark').length,
    sardineBalls: out.swimmers.filter(s => s.kind === 'sardines').length, sardines: nFish,
    turtles: out.swimmers.filter(s => s.kind === 'turtle').length,
    freedivers: out.swimmers.filter(s => s.kind === 'freediver').length,
    scuba: out.swimmers.filter(s => s.kind === 'scuba').length,
    companions: out.people.filter(p => p.c.group === 'companion').length,
    locals: out.people.filter(p => p.c.group === 'local').length,
  });
  out.setFishCount = (n) => { fish.count = Math.min(nFish, n); };
  return out;
}
