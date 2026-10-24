// Terrain field: signed distance to coast (positive = land), height, sea floor, helpers.
// Shared by the terrain, props and the animals / people so that everybody agrees
// on where land and water are.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
export function fbm(x, z) {
  return vnoise(x, z) * 0.55 + vnoise(x * 2.1 + 17.3, z * 2.1 - 4.1) * 0.3 + vnoise(x * 4.3 - 9.7, z * 4.3 + 2.2) * 0.15;
}

export const SEA_LEVEL = 0;
export const BEACH_W = 0.9;      // sand band width (units)
export const GROUND = 0.55;      // first grass terrace height
const STEP = 0.42;               // terrace step

export class Field {
  constructor(geo) {
    const g = geo.grid;
    this.x0 = g.x0; this.z0 = g.z0; this.res = g.res; this.nx = g.nx; this.nz = g.nz;
    this.x1 = this.x0 + (this.nx - 1) * this.res;
    this.z1 = this.z0 + (this.nz - 1) * this.res;
    const bin = atob(geo.sd);
    const sd = new Float32Array(bin.length);
    for (let i = 0; i < bin.length; i++) sd[i] = (bin.charCodeAt(i) - 128) / 10;
    this.sdv = sd;
    this.proj = geo.proj;
    this.bumps = [];   // extra height bumps {x,z,r,h}
  }
  ll(lat, lon) {
    const p = this.proj;
    return [(lon - p.lon0) * p.sx, -(lat - p.lat0) * p.sz];
  }
  inside(x, z, m = 0) {
    return x > this.x0 + m && x < this.x1 - m && z > this.z0 + m && z < this.z1 - m;
  }
  sd(x, z) {
    if (!this.inside(x, z)) return -13;
    const fx = (x - this.x0) / this.res, fz = (z - this.z0) / this.res;
    const i = Math.min(this.nx - 2, Math.floor(fx)), j = Math.min(this.nz - 2, Math.floor(fz));
    const tx = fx - i, tz = fz - j, n = this.nx, v = this.sdv;
    const a = v[j * n + i], b = v[j * n + i + 1], c = v[(j + 1) * n + i], d = v[(j + 1) * n + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }
  grad(x, z) {
    const e = 0.4;
    const gx = this.sd(x + e, z) - this.sd(x - e, z);
    const gz = this.sd(x, z + e) - this.sd(x, z - e);
    const l = Math.hypot(gx, gz) || 1;
    return [gx / l, gz / l];   // points inland
  }
  // raw terrain height for a given signed distance
  heightAt(x, z, s = this.sd(x, z)) {
    if (s < 0) {
      const d = Math.min(1, -s / 7);
      return -0.26 - Math.pow(d, 0.75) * 3.4;
    }
    if (s < BEACH_W) return 0.12 + s * 0.13;
    const k = Math.min(1, (s - BEACH_W) / 3.6);
    let h = GROUND + k * (0.2 + fbm(x * 0.055, z * 0.055) * 2.5 + Math.min(s, 12.8) * 0.13);
    // soft terraces → layered, toy-model plateaus
    const t = (h - GROUND) / STEP, f = Math.floor(t), fr = t - f;
    const e = fr < 0.78 ? 0 : (fr - 0.78) / 0.22;
    h = GROUND + (f + e * e * (3 - 2 * e)) * STEP;
    // short ramp from beach to first terrace
    if (s < BEACH_W + 0.5) h = 0.12 + BEACH_W * 0.13 + (h - 0.12 - BEACH_W * 0.13) * ((s - BEACH_W) / 0.5);
    // town plains: coastal towns sit on flat ground
    for (const b of this.bumps) {
      const dd = Math.hypot(x - b.x, z - b.z);
      if (dd < b.r) {
        const w = 1 - dd / b.r, e2 = Math.min(1, w * 1.8), sm = e2 * e2 * (3 - 2 * e2);
        h = b.flat ? (h + (Math.min(h, b.h) - h) * sm) : h + b.h * w;
      }
    }
    return h;
  }
  // final height incl. the sunken world rim (everything uses this)
  h(x, z, s) {
    let h = this.heightAt(x, z, s);
    const edge = Math.min(x - this.x0, this.x1 - x, z - this.z0, this.z1 - z);
    if (edge < 7 && h > -3.6) h = -3.6 + (h + 3.6) * Math.max(0, edge / 7);
    return h;
  }
  // walk inland/seaward along gradient until reaching target signed distance
  seek(x, z, target) {
    for (let i = 0; i < 80; i++) {
      const s = this.sd(x, z);
      if (Math.abs(s - target) < 0.15) break;
      const [gx, gz] = this.grad(x, z);
      const st = Math.max(0.1, Math.min(1, Math.abs(s - target) * 0.5)) * Math.sign(target - s);
      x += gx * st; z += gz * st;
    }
    return [x, z];
  }
}

// Spatial hash of circular obstacles (buildings, trees, props)
export class Obstacles {
  constructor(cell = 1.5) { this.cell = cell; this.map = new Map(); this.list = []; }
  key(i, j) { return i * 73856093 ^ j * 19349663; }
  add(x, z, r, tag = '') {
    const o = { x, z, r, tag };
    this.list.push(o);
    const c = this.cell;
    const i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c);
    const j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this.key(i, j);
      let a = this.map.get(k); if (!a) { a = []; this.map.set(k, a); }
      a.push(o);
    }
    return o;
  }
  hit(x, z, r = 0) {
    const c = this.cell;
    const i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c);
    const j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = this.map.get(this.key(i, j)); if (!a) continue;
      for (const o of a) { const dx = x - o.x, dz = z - o.z, rr = r + o.r; if (dx * dx + dz * dz < rr * rr) return o; }
    }
    return null;
  }
}
