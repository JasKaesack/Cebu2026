// Towns, landmarks, vegetation and boats.
import * as THREE from 'three';
import * as K from './kit.js';
import { mulberry32, GROUND } from './field.js';

const WALLS = ['#F6EEDF', '#FAF6EF', '#F2DDA4', '#F1C9B8', '#D5E9D6', '#D3E3EE', '#F4E3C9', '#EDE7F2'];
const ROOFS = ['#D9734E', '#C95A40', '#4F9C9A', '#6D8BA0', '#A9B0B3', '#E28A5B', '#B5503B', '#5E8F6E'];

// Towns: [lat, lon, radius(units), count, tower share, style]
const TOWNS = [
  [10.304, 123.893, 6.2, 230, 0.30, 'city'],   // Cebu City
  [10.336, 123.935, 3.4, 80, 0.14, 'city'],    // Mandaue
  [10.256, 123.836, 3.0, 50, 0.05, 'town'],    // Talisay
  [10.226, 123.785, 2.0, 26, 0.0, 'town'],     // Minglanilla / Naga
  [10.304, 124.005, 1.8, 26, 0.04, 'town'],    // Lapu-Lapu (Mactan)
  [10.105, 123.648, 2.2, 32, 0.0, 'town'],     // Carcar
  [9.880, 123.604, 1.8, 20, 0.0, 'town'],      // Argao
  [9.762, 123.536, 1.4, 15, 0.0, 'town'],      // Dalaguete
  [9.940, 123.396, 2.0, 26, 0.0, 'town'],      // Moalboal poblacion
  [9.946, 123.373, 1.4, 20, 0.0, 'resort'],    // Panagsama
  [9.868, 123.396, 1.4, 14, 0.0, 'town'],      // Badian
  [9.524, 123.433, 1.8, 26, 0.0, 'town'],      // Oslob
  [9.422, 123.338, 1.2, 12, 0.0, 'town'],      // Santander
  [10.116, 123.514, 1.4, 14, 0.0, 'town'],     // Barili
  [10.380, 123.645, 2.0, 24, 0.0, 'town'],     // Toledo
  [9.657, 123.866, 3.0, 95, 0.05, 'town'],     // Tagbilaran
  [9.552, 123.776, 1.6, 30, 0.0, 'resort'],    // Alona
  [9.596, 123.770, 1.3, 12, 0.0, 'resort'],    // Momo / Panglao north
  [9.626, 123.820, 1.3, 16, 0.0, 'town'],      // Dauis
  [9.622, 123.913, 1.1, 14, 0.0, 'town'],      // Baclayon
  [9.640, 124.036, 1.1, 14, 0.0, 'town'],      // Loboc
  [9.602, 124.012, 1.0, 12, 0.0, 'town'],      // Loay
  [9.822, 124.198, 1.3, 14, 0.0, 'town'],      // Carmen
  [9.952, 123.962, 1.4, 16, 0.0, 'town'],      // Tubigon
  [9.652, 124.366, 1.4, 14, 0.0, 'town'],      // Jagna
  [9.308, 123.302, 2.0, 22, 0.0, 'town'],      // Dumaguete (Negros)
  [10.118, 123.272, 1.5, 12, 0.0, 'town'],     // Guihulngan (Negros)
];

export function townBumps(field) {
  for (const [lat, lon, R] of TOWNS) {
    const [x, z] = field.ll(lat, lon);
    field.bumps.push({ x, z, r: R * 1.35 + 0.8, h: GROUND + 0.05, flat: true });
  }
}

export function buildProps(ctx) {
  const { scene, field, obst, tier, geo } = ctx;
  const rnd = mulberry32(20261203);
  const P = (k) => geo.places[k];
  const LL = (a, b) => field.ll(a, b);
  const dummy = new THREE.Object3D();
  const castShadow = tier !== 'low';

  const matV = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, flatShading: true });
  const matWalls = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true });
  const matWin = new THREE.MeshStandardMaterial({ color: '#E8E0D2', emissive: new THREE.Color('#FFC56B'), emissiveIntensity: 0, roughness: 0.6 });
  const matBulb = new THREE.MeshStandardMaterial({ color: '#F4EEDF', emissive: new THREE.Color('#FFD58A'), emissiveIntensity: 0, roughness: 0.5 });
  const matHill = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });

  let vk = 1, lastT = 0;                       // vehicle zoom scale (1 = close-up), set by island.js
  const scalables = [];                         // {obj, base, cap}
  const out = { updaters: [], nightMats: { win: matWin, bulb: matBulb }, lampSpots: [], bancas: [], reserved: ctx.reserved || [] };

  // keep walk zones free of buildings
  const reserved = out.reserved;
  const isReserved = (x, z, r) => reserved.some(o => Math.hypot(x - o.x, z - o.z) < o.r + r && field.sd(x, z) < o.smax + 0.45 + r);

  // Loboc river corridor. Reserved up front, before a single building, palm or
  // resort is placed, so nothing ends up standing in the water.
  // Pier: Loboc River Cruise, 9.6347975 / 124.0298253 (Google Places, 2026-10-26).
  // Turn-around: Busai Dream Falls, 9.6723232 / 124.0478767 — the cruise runs
  // upstream from the pier and back, so only that reach carries the boat.
  const RIVER = [[9.6723, 124.0479], [9.6640, 124.0442], [9.6530, 124.0380], [9.6430, 124.0330],
                 [9.6348, 124.0298], [9.6230, 124.0240], [9.6100, 124.0160], [9.5960, 124.0100]];
  const riverCurve = new THREE.CatmullRomCurve3(RIVER.map(a => LL(...a)).map(([x, z]) => new THREE.Vector3(x, 0, z)));
  for (let i = 0; i <= 64; i++) { const q = riverCurve.getPointAt(i / 64); obst.add(q.x, q.z, 0.82, 'river'); }

  // --------------------------------------------------------------- buildings
  const B = { house: [], tower: [], nipa: [] };
  const dbg = { inside: 0, sea: 0, high: 0, slope: 0, obst: 0, res: 0, ok: 0 };
  function tryBuilding(x, z, kind, w, d, h, rot) {
    if (!field.inside(x, z, 9)) { dbg.inside++; return false; }
    const s = field.sd(x, z);
    const r = Math.max(w, d) * 0.62;
    if (kind === 'nipa') { if (s < 0.5 || s > 3.5) return false; }
    else if (s < 1.05) { dbg.sea++; return false; }
    const y = field.h(x, z);
    if (y > GROUND + 1.4) { dbg.high++; return false; }
    // flat enough?
    const y2 = Math.max(field.h(x + r, z), field.h(x - r, z), field.h(x, z + r), field.h(x, z - r));
    const y1 = Math.min(field.h(x + r, z), field.h(x - r, z), field.h(x, z + r), field.h(x, z - r));
    if (y2 - y1 > 0.28) { dbg.slope++; return false; }
    if (obst.hit(x, z, r)) { dbg.obst++; return false; }
    if (isReserved(x, z, r)) { dbg.res++; return false; }
    dbg.ok++;
    obst.add(x, z, r, 'bld');
    B[kind].push({ x, z, y: y1, w, d, h, rot, wall: WALLS[(rnd() * WALLS.length) | 0], roof: ROOFS[(rnd() * ROOFS.length) | 0] });
    return true;
  }
  // landmarks first (so they win their spot)
  const landmark = (geom, x, z, s, rot, r) => {
    const m = new THREE.Mesh(geom, matV);
    m.position.set(x, field.h(x, z), z); m.rotation.y = rot; m.scale.setScalar(s);
    m.castShadow = castShadow; m.receiveShadow = true; scene.add(m);
    obst.add(x, z, r, 'landmark');
    return m;
  };
  {
    const [hx, hz] = P('holidayinn');
    obst.add(hx, hz, 0.9, 'bld');
    B.tower.push({ x: hx, z: hz, y: field.h(hx, hz), w: 1.0, d: 0.8, h: 3.2, rot: 0.3, wall: '#F3EEE6', roof: '#2C6E8A' });
    let [cx, cz] = LL(10.2945, 123.9015); landmark(K.church(), cx, cz, 0.7, 0.4, 1.0);
    [cx, cz] = LL(9.5215, 123.4320); landmark(K.church(), cx, cz, 0.6, -0.3, 0.9);
    [cx, cz] = LL(10.1075, 123.6440); landmark(K.church(), cx, cz, 0.55, 0.2, 0.8);
    [cx, cz] = LL(9.6230, 123.9140); landmark(K.church(), cx, cz, 0.5, 0.1, 0.8);
    // Loboc's riverside church, nudged onto the north bank: the cruise channel is
    // drawn far wider than the real river so the boat reads at map scale, and at
    // its true lon it would stand in the water.
    [cx, cz] = LL(9.6395, 124.0385); landmark(K.church(), cx, cz, 0.5, 1.9, 0.8);
  }
  // airport (runway ~ NE–SW)
  {
    const [ax, az] = P('mcia');
    const g = new THREE.Group();
    const rw = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 4.2), new THREE.MeshStandardMaterial({ color: '#5C6670', roughness: 0.95 }));
    rw.receiveShadow = true; g.add(rw);
    const dash = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.045, 0.18), new THREE.MeshBasicMaterial({ color: '#F4F2EA' }), 12);
    for (let i = 0; i < 12; i++) { dummy.position.set(0, 0.002, -1.9 + i * 0.35); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); dash.setMatrixAt(i, dummy.matrix); }
    g.add(dash);
    g.position.set(ax + 0.25, field.h(ax, az) + 0.02, az); g.rotation.y = -0.70; scene.add(g);
    for (let i = -2; i <= 2; i++) obst.add(ax + 0.25 + Math.sin(-0.7) * i * 0.9, az + Math.cos(-0.7) * i * 0.9, 0.5, 'rw');
    const term = new THREE.Mesh(K.bake([K.part(K.G.box(), '#EEF0F0', K.M(0, 0, 0, 0, 0, 0, 1.6, 0.32, 0.5)),
      K.part(K.G.box(), '#7FA7BF', K.M(0, 0.32, 0, 0, 0, 0, 1.7, 0.06, 0.6))]), matV);
    term.position.set(ax - 0.75, field.h(ax - 0.75, az - 0.5), az - 0.5); term.rotation.y = -0.7; term.castShadow = castShadow; scene.add(term);
    obst.add(ax - 0.75, az - 0.5, 1.0, 'bld');
    const pl = K.plane();
    for (const [dx, dz, r] of [[-0.25, 0.35, 2.4], [-0.55, -0.15, 2.0]]) {
      const m = new THREE.Mesh(pl, matV); m.scale.setScalar(0.32);
      m.position.set(ax + dx, field.h(ax, az) + 0.03, az + dz); m.rotation.y = r; m.castShadow = castShadow; scene.add(m);
    }
  }
  // bridges Cebu ↔ Mactan
  for (const [a, b] of [[[10.322, 123.946], [10.320, 123.953]], [[10.335, 123.952], [10.334, 123.960]]]) {
    const [x1, z1] = LL(...a), [x2, z2] = LL(...b);
    const len = Math.hypot(x2 - x1, z2 - z1) + 0.6;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, len), new THREE.MeshStandardMaterial({ color: '#E8E4DA', roughness: 0.9 }));
    m.position.set((x1 + x2) / 2, 0.42, (z1 + z2) / 2); m.rotation.y = Math.atan2(x2 - x1, z2 - z1); m.castShadow = castShadow; scene.add(m);
  }
  // piers
  function pier(key, len, ang) {
    const [px, pz] = P(key);
    const [gx, gz] = field.grad(px, pz);           // inland direction
    const a = ang ?? Math.atan2(-gx, -gz);         // point seaward
    const g = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, len), new THREE.MeshStandardMaterial({ color: '#C9B08A', roughness: 0.95 }));
    deck.position.set(0, 0.24, len / 2); deck.castShadow = castShadow; deck.receiveShadow = true; g.add(deck);
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 5), new THREE.MeshStandardMaterial({ color: '#7D6047' }), Math.ceil(len / 0.5) * 2);
    let n = 0;
    for (let zz = 0.2; zz < len; zz += 0.5) for (const xx of [-0.15, 0.15]) { dummy.position.set(xx, 0, zz); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); posts.setMatrixAt(n++, dummy.matrix); }
    posts.count = n; g.add(posts);
    const [sx, sz] = field.seek(px, pz, 0.2);
    g.position.set(sx, 0, sz); g.rotation.y = a; scene.add(g);
    return { x: sx + Math.sin(a) * len, z: sz + Math.cos(a) * len, a };
  }
  const p1 = pier('pier1', 2.2), ptag = pier('tagbilaran', 2.0), pq = pier('quartel', 1.4);
  pier('momo', 1.0);

  // towns
  for (const [lat, lon, R, n, towerShare, style] of TOWNS) {
    const [cx, cz] = LL(lat, lon);
    let placed = 0, tries = 0;
    while (placed < n && tries < n * 14) {
      tries++;
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * R;
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      const centre = 1 - rr / R;
      const rot = (style === 'city' ? Math.round(rnd() * 3) * Math.PI / 2 + 0.35 : rnd() * Math.PI);
      let ok = false;
      if (style === 'resort' && rnd() < 0.55) ok = tryBuilding(x, z, 'nipa', 0.62, 0.62, 0.5, rnd() * 6);
      else if (rnd() < towerShare * (0.4 + centre * 1.6)) {
        const w = 0.6 + rnd() * 0.5, h = 1.1 + rnd() * 2.3 * (0.4 + centre);
        ok = tryBuilding(x, z, 'tower', w, w * (0.8 + rnd() * 0.4), h, rot);
      } else {
        const w = 0.42 + rnd() * 0.32, d = 0.4 + rnd() * 0.3;
        ok = tryBuilding(x, z, 'house', w, d, 0.36 + rnd() * 0.24, rot);
      }
      if (ok) placed++;
    }
  }
  // scattered coastal villages
  for (let v = 0; v < (tier === 'low' ? 50 : 95); v++) {
    let x, z, s, k = 0;
    do { x = field.x0 + rnd() * (field.x1 - field.x0); z = field.z0 + rnd() * (field.z1 - field.z0); s = field.sd(x, z); k++; } while ((s < 1.2 || s > 3.2) && k < 60);
    if (k >= 60) continue;
    const m = 2 + ((rnd() * 4) | 0);
    for (let i = 0; i < m; i++) tryBuilding(x + (rnd() - 0.5) * 1.8, z + (rnd() - 0.5) * 1.8, 'house', 0.4 + rnd() * 0.22, 0.38 + rnd() * 0.2, 0.34 + rnd() * 0.14, rnd() * Math.PI);
  }

  // instanced building meshes
  function inst(geo, mat, n, shadow = true) {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    m.castShadow = shadow && castShadow; m.receiveShadow = true;
    scene.add(m); return m;
  }
  const col = new THREE.Color();
  {
    const H = B.house, bodies = inst(K.houseBody(), matWalls, H.length), roofs = inst(K.gableRoof(), matWalls, H.length), wins = inst(K.windowsGeo(), matWin, H.length, false);
    H.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z); dummy.rotation.set(0, b.rot, 0); dummy.scale.set(b.w, b.h, b.d); dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix); wins.setMatrixAt(i, dummy.matrix);
      bodies.setColorAt(i, col.set(b.wall));
      dummy.position.y = b.y + b.h; dummy.scale.set(b.w * 1.12, b.h * 0.75, b.d * 1.12); dummy.updateMatrix();
      roofs.setMatrixAt(i, dummy.matrix); roofs.setColorAt(i, col.set(b.roof));
    });
    const T = B.tower, tb = inst(K.houseBody(), matWalls, T.length), tw = inst(K.towerWindowsGeo(), matWin, T.length, false), tr = inst(K.houseBody(), matWalls, T.length);
    T.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z); dummy.rotation.set(0, b.rot, 0); dummy.scale.set(b.w, b.h, b.d); dummy.updateMatrix();
      tb.setMatrixAt(i, dummy.matrix); tw.setMatrixAt(i, dummy.matrix);
      tb.setColorAt(i, col.set(i % 3 === 0 ? '#E9EEF1' : b.wall));
      dummy.position.y = b.y + b.h; dummy.scale.set(b.w * 0.5, 0.14, b.d * 0.45); dummy.updateMatrix();
      tr.setMatrixAt(i, dummy.matrix); tr.setColorAt(i, col.set(b.roof));
    });
    const N = B.nipa, nh = inst(K.nipaHut(), matV, N.length);
    N.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z); dummy.rotation.set(0, b.rot, 0); dummy.scale.setScalar(0.72 + rnd() * 0.18); dummy.updateMatrix(); nh.setMatrixAt(i, dummy.matrix);
    });
    out.counts = { houses: H.length, towers: T.length, huts: N.length, dbg };
  }

  // ------------------------------------------------------------- resorts / special spots
  function lawn(x, z, r, color) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 14), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, field.h(x, z) + 0.03, z); m.receiveShadow = true; scene.add(m);
  }
  function pool(x, z, w, d, rot) {
    const g = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.06, d + 0.12), new THREE.MeshStandardMaterial({ color: '#F4EFE6' }));
    const wat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.065, d), new THREE.MeshStandardMaterial({ color: '#57C8D6', roughness: 0.2, emissive: '#1C7F8F', emissiveIntensity: 0.15 }));
    wat.position.y = 0.004; rim.receiveShadow = true; g.add(rim, wat);
    g.position.set(x, field.h(x, z) + 0.02, z); g.rotation.y = rot; scene.add(g);
    obst.add(x, z, Math.max(w, d) * 0.6, 'pool');
  }
  {
    const [wx, wz] = P('wgolf');
    const [lx, lz] = field.seek(wx, wz, 2.2);
    lawn(lx, lz, 1.6, '#A6D27A'); obst.add(lx, lz, 1.2, 'lawn');
    const flag = new THREE.Mesh(K.bake([K.part(K.G.cyl(4), '#EEE', K.M(0, 0, 0, 0, 0, 0, 0.02, 0.45, 0.02)), K.part(K.G.box(), '#E0573C', K.M(0.07, 0.36, 0, 0, 0, 0, 0.14, 0.09, 0.01))]), matV);
    flag.position.set(lx + 0.4, field.h(lx, lz) + 0.03, lz - 0.3); scene.add(flag);
    for (let i = 0; i < 6; i++) tryBuilding(wx + (rnd() - 0.5) * 1.5, wz + (rnd() - 0.5) * 1.5, 'house', 0.45, 0.4, 0.3, 0.2);
    const [bx, bz] = P('bathala'); pool(bx + 0.5, bz - 0.9, 0.7, 0.4, 0.3);
    const [ax2, az2] = P('amihan'); pool(ax2 - 0.7, az2 - 1.1, 0.6, 0.35, -0.2);
  }
  // Kawasan Falls
  {
    const [kx, kz] = P('kawasan');
    const g = new THREE.Group();
    const rock = new THREE.Mesh(K.bake([K.part(K.G.ico(0), '#8C8A7A', K.M(0, 0.3, 0, 0, 0, 0, 1.4, 1.2, 0.8)), K.part(K.G.ico(0), '#7A7868', K.M(0.5, 0.2, 0.1, 0, 1, 0, 0.8, 0.8, 0.7))]), matV);
    rock.position.set(0, 0, -0.55); rock.castShadow = castShadow; g.add(rock);
    const waterMat = new THREE.MeshStandardMaterial({ color: '#E4F6F7', emissive: '#9FE3E6', emissiveIntensity: 0.2, transparent: true, opacity: 0.85 });
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.75), waterMat); fall.position.set(0, 0.42, -0.12); g.add(fall);
    const poolM = new THREE.Mesh(new THREE.CircleGeometry(0.85, 12), new THREE.MeshStandardMaterial({ color: '#4FC9C4', roughness: 0.2, emissive: '#1E8F8C', emissiveIntensity: 0.2 }));
    poolM.rotation.x = -Math.PI / 2; poolM.position.set(0, 0.04, 0.45); g.add(poolM);
    const foam = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.3, 10), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }));
    foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.05, 0.05); g.add(foam);
    g.position.set(kx, field.h(kx, kz), kz); g.rotation.y = 0.9; scene.add(g);
    obst.add(kx, kz, 1.3, 'falls');
    out.updaters.push((dt, t) => { foam.scale.setScalar(1 + Math.sin(t * 3) * 0.15); waterMat.opacity = 0.78 + Math.sin(t * 5) * 0.06; });
  }
  // ----------------------------------------------- Loboc river + cruise boat
  // Pier: Loboc River Cruise, 9.6347975 / 124.0298253 (Google Places, 2026-10-26).
  // Turn-around: Busai Dream Falls, 9.6723232 / 124.0478767 — the cruise runs
  // upstream from the pier and comes back, so only that reach carries the boat.
  {
    const curve = riverCurve;
    const N = 70, pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const p = curve.getPointAt(i / N), t = curve.getTangentAt(i / N);
      const nx = -t.z, nz = t.x, w = 0.52;          // widened for visibility; course and location unchanged
      const y = field.h(p.x, p.z) + 0.04;            // flat across the channel, so no sloped water
      for (const s of [-1, 1]) {
        const x = p.x + nx * w * s, z = p.z + nz * w * s;
        pos.push(x, y, z);
      }
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#4FA79C', roughness: 0.3, side: THREE.DoubleSide }));
    m.receiveShadow = true; scene.add(m);

    // the cruise reach only: pier (index 4) back up to Busay (index 0)
    const reach = new THREE.CatmullRomCurve3(RIVER.slice(0, 5).reverse().map(a => LL(...a)).map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const reachLen = reach.getLength();
    const boat = new THREE.Mesh(K.cruiseBoat(), matV);
    boat.scale.setScalar(0.5); boat.castShadow = castShadow; scene.add(boat);
    out.lobocBoat = boat;
    // out-and-back: run → slow down → pause → swing the bow round → run back
    const ONE_WAY = 22, PAUSE = 3.0, TURN = 3.2;      // ≈ 56 s per full round trip
    const TURN_RATE = 1.15;                           // rad/s cap: the bow swings round, never snaps
    let u = 0.04, dir = 1, phase = 'run', timer = 0, heading = 0, headSet = false;
    out.updaters.push((dt, t) => {
      let speed = 1;
      if (phase === 'pause') { speed = 0; timer -= dt; if (timer <= 0) { phase = 'turn'; timer = TURN; dir = -dir; } }
      else if (phase === 'turn') { speed = 0; timer -= dt; if (timer <= 0) { phase = 'run'; } }
      else {
        const edge = dir > 0 ? (1 - u) : u;             // ease the last 12 % of the reach
        speed = Math.max(0.12, Math.min(1, edge / 0.12));
        u += dir * dt * speed / ONE_WAY;
        if (u >= 1) { u = 1; phase = 'pause'; timer = PAUSE; }
        if (u <= 0) { u = 0; phase = 'pause'; timer = PAUSE; }
      }
      const p = reach.getPointAt(Math.max(0, Math.min(1, u))), tg = reach.getTangentAt(Math.max(0, Math.min(1, u)));
      const want = Math.atan2(tg.x * dir, tg.z * dir);
      if (!headSet) { heading = want; headSet = true; }
      let d = want - heading; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      let step = d * Math.min(1, dt * (phase === 'turn' ? 2.2 : 2.6));
      const cap = TURN_RATE * dt;                     // never faster than TURN_RATE, so no 180 deg snap
      if (Math.abs(step) > cap) step = Math.sign(step) * cap;
      heading += step;
      boat.position.set(p.x, field.h(p.x, p.z) + 0.07 + Math.sin(t * 1.1) * 0.012, p.z);
      boat.rotation.set(Math.sin(t * 0.9) * 0.012, heading, Math.sin(t * 1.3) * 0.016);
    });
    out.landmarks = out.landmarks || [];
    // label the middle of the cruise reach, not the pier itself: the pier already
    // carries the 12/7 date marker, and the reach is what the boat actually runs
    { const [lx, lz] = LL(9.6530, 124.0380); out.landmarks.push({ id: 'lm_loboc', x: lx, z: lz, y: field.h(lx, lz) + 1.0 }); }
  }

  // ----------------------------------------------- Chocolate Hills + a chocolate bar
  // Anchor: Chocolate Hills Complex, Carmen — 9.7986441 / 124.1674637 (Google Places).
  // One cluster only; the hills are a spread-out group, so they fan out from the
  // viewing complex rather than sitting on "the middle of Bohol".
  {
    const [cx, cz] = P('chocolate');
    const hills = []; let tries = 0;
    const target = tier === 'low' ? 13 : 17;            // a readable group, not a field of cones
    while (hills.length < target && tries < 3000) {
      tries++;
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 6.0;
      const x = cx + Math.cos(a) * rr * 1.2, z = cz + Math.sin(a) * rr;
      const r = 0.95 + rnd() * 0.85;
      if (field.sd(x, z) < 3) continue;
      if (hills.some(h => Math.hypot(h.x - x, h.z - z) < h.r + r + 0.25)) continue;
      if (obst.hit(x, z, r)) continue;
      hills.push({ x, z, r, h: 1.9 + rnd() * 1.4 });    // clearly above the tree canopy
    }
    hills.unshift({ x: cx, z: cz, r: 1.3, h: 3.1, deck: true });
    const m = new THREE.InstancedMesh(K.hillDome(), matHill, hills.length);
    const BROWN = new THREE.Color('#7B4A26'), GREEN = new THREE.Color('#6F9441');
    hills.forEach((hl, i) => {
      dummy.position.set(hl.x, field.h(hl.x, hl.z) - 0.08, hl.z);
      dummy.rotation.set(0, rnd() * 6, 0); dummy.scale.set(hl.r * 2, hl.h, hl.r * 2); dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, col.copy(BROWN).lerp(GREEN, 0.12 + rnd() * 0.55));
      obst.add(hl.x, hl.z, hl.r + 1.35, 'hill');   // keep the canopy off the hills' grassy flanks
    });
    m.castShadow = castShadow; m.receiveShadow = true; scene.add(m);
    const d = hills[0];
    const deck = new THREE.Mesh(K.bake([K.part(K.G.box(), '#F1ECE2', K.M(0, 0, 0, 0, 0, 0, 0.5, 0.18, 0.5)),
      K.part(K.G.pyr(), '#C9573F', K.M(0, 0.18, 0, 0, 0, 0, 0.55, 0.2, 0.55))]), matV);
    deck.position.set(d.x, field.h(d.x, d.z) + d.h - 0.12, d.z); deck.castShadow = castShadow; scene.add(deck);
    // the joke: an actual bar of chocolate parked beside the hills
    const bar = new THREE.Mesh(K.chocolateBar(), matV);
    const bx = cx - 5.6, bz = cz + 4.2;
    bar.scale.setScalar(2.7);
    bar.position.set(bx, field.h(bx, bz) + 0.16, bz); bar.rotation.y = -0.45;
    bar.castShadow = castShadow; bar.receiveShadow = true; scene.add(bar);
    obst.add(bx, bz, 1.2, 'choc');
    out.hills = hills.length;
    out.landmarks = out.landmarks || [];
    out.landmarks.push({ id: 'lm_choc', x: cx, z: cz, y: field.h(cx, cz) + d.h + 1.1 });
  }

  // ------------------------------------------------------------- lamps (night lights) near key spots
  {
    const spots = [P('pier1'), P('holidayinn'), P('panagsama'), P('wgolf'), P('quartel'), P('alona'), P('tagbilaran'), P('momo')];
    const L = [], lg = K.lamp(), bg = K.bulb();
    for (const [x0, z0] of spots) {
      let n = 0, k = 0;
      while (n < 7 && k < 80) {
        k++;
        const x = x0 + (rnd() - 0.5) * 4, z = z0 + (rnd() - 0.5) * 4, s = field.sd(x, z);
        if (s < 0.6 || s > 2.4 || obst.hit(x, z, 0.12) || isReserved(x, z, 0.1)) continue;
        obst.add(x, z, 0.12, 'lamp'); L.push([x, z, rnd() * 6]); n++;
      }
      out.lampSpots.push([x0, z0]);
    }
    const lm = inst(lg, matV, L.length, false), bm = inst(bg, matBulb, L.length, false);
    L.forEach(([x, z, r], i) => { dummy.position.set(x, field.h(x, z), z); dummy.rotation.set(0, r, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); lm.setMatrixAt(i, dummy.matrix); bm.setMatrixAt(i, dummy.matrix); });
  }

  // ------------------------------------------------------------- beach umbrellas & loungers
  {
    const U = [], Lo = [];
    for (const key of ['alona', 'panagsama', 'momo', 'quartel', 'virgin']) {
      const [x0, z0] = P(key);
      let n = 0, k = 0;
      while (n < 10 && k < 140) {
        k++;
        const x = x0 + (rnd() - 0.5) * 4.5, z = z0 + (rnd() - 0.5) * 4.5, s = field.sd(x, z);
        if (s < 0.15 || s > 0.75 || obst.hit(x, z, 0.32) || (isReserved(x, z, 0.2) && rnd() < 0.6)) continue;
        obst.add(x, z, 0.32, 'umb'); U.push([x, z]); Lo.push([x + 0.2, z + 0.15]); n++;
      }
    }
    const um = inst(K.umbrella(), matV, U.length), lo = inst(K.lounger(), matV, Lo.length);
    const UC = ['#E8673A', '#2F9EA8', '#F2C14E', '#F7F3EA', '#D9534F', '#6FB07F'];
    U.forEach(([x, z], i) => {
      dummy.position.set(x, field.h(x, z), z); dummy.rotation.set(0, rnd() * 6, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
      um.setMatrixAt(i, dummy.matrix); um.setColorAt(i, col.set(UC[i % UC.length]));
    });
    Lo.forEach(([x, z], i) => { dummy.position.set(x, field.h(x, z), z); dummy.rotation.set(0, rnd() * 6, 0); dummy.updateMatrix(); lo.setMatrixAt(i, dummy.matrix); });
  }

  // ------------------------------------------------------------- vegetation
  {
    const palms = [], trees = [], bushes = [], mahog = [];
    const nP = tier === 'low' ? 1100 : tier === 'mid' ? 1900 : 2600, nT = tier === 'low' ? 1500 : tier === 'mid' ? 2600 : 3600, nB = tier === 'low' ? 300 : tier === 'mid' ? 600 : 900;
    const randLand = (smin, smax) => {
      for (let k = 0; k < 40; k++) {
        const x = field.x0 + rnd() * (field.x1 - field.x0), z = field.z0 + rnd() * (field.z1 - field.z0), s = field.sd(x, z);
        if (s >= smin && s <= smax && field.inside(x, z, 8)) return [x, z];
      }
      return null;
    };
    // Bilar man-made forest: mahogany along the road
    const fa = LL(9.652, 124.055), fb = LL(9.672, 124.095);
    for (let i = 0; i < (tier === 'low' ? 60 : 140); i++) {
      const t = rnd(), side = rnd() < 0.5 ? -1 : 1;
      const dx = fb[0] - fa[0], dz = fb[1] - fa[1], L = Math.hypot(dx, dz);
      const off = side * (0.35 + rnd() * 1.4);
      const x = fa[0] + dx * t - dz / L * off, z = fa[1] + dz * t + dx / L * off;
      if (obst.hit(x, z, 0.16)) continue;
      obst.add(x, z, 0.15, 'tree'); mahog.push([x, z]);
    }
    let k = 0;
    while (palms.length < nP && k++ < nP * 5) {
      const p = randLand(0.55, 3.4); if (!p) continue;
      const [x, z] = p; if (obst.hit(x, z, 0.18) || (isReserved(x, z, 0.12) && rnd() < 0.8)) continue;
      obst.add(x, z, 0.16, 'tree'); palms.push([x, z]);
    }
    k = 0;
    while (trees.length < nT && k++ < nT * 5) {
      const p = randLand(2.2, 14); if (!p) continue;
      const [x, z] = p; if (field.h(x, z) > 4.2 || obst.hit(x, z, 0.3)) continue;
      // clumping: keep with probability from noise
      if (Math.sin(x * 0.37) * Math.cos(z * 0.29) + rnd() * 0.9 < -0.2) continue;
      obst.add(x, z, 0.26, 'tree'); trees.push([x, z]);
    }
    k = 0;
    while (bushes.length < nB && k++ < nB * 5) {
      const p = randLand(0.8, 6); if (!p) continue;
      const [x, z] = p; if (obst.hit(x, z, 0.16) || isReserved(x, z, 0.1)) continue;
      obst.add(x, z, 0.14, 'bush'); bushes.push([x, z]);
    }
    const pg = [K.palm(0), K.palm(1), K.palm(2)];
    const pm = pg.map((g, gi) => inst(g, matV, Math.ceil(palms.length / 3)));
    const pc = [0, 0, 0];
    palms.forEach(([x, z], i) => {
      const gi = i % 3, s = 0.75 + rnd() * 0.45;
      dummy.position.set(x, field.h(x, z), z); dummy.rotation.set(0, rnd() * 6.28, 0); dummy.scale.setScalar(s); dummy.updateMatrix();
      pm[gi].setMatrixAt(pc[gi]++, dummy.matrix);
    });
    pm.forEach((m, i) => m.count = pc[i]);
    const tm = inst(K.roundTree(), matV, trees.length);
    trees.forEach(([x, z], i) => {
      const s = 0.7 + rnd() * 0.6;
      dummy.position.set(x, field.h(x, z), z); dummy.rotation.set(0, rnd() * 6.28, 0); dummy.scale.set(s, s * (0.85 + rnd() * 0.4), s); dummy.updateMatrix();
      tm.setMatrixAt(i, dummy.matrix);
      const t = rnd(); tm.setColorAt(i, col.setRGB(0.82 + t * 0.2, 0.9 + t * 0.1, 0.78 + t * 0.12));
    });
    const bm = inst(K.bush(), matV, bushes.length);
    bushes.forEach(([x, z], i) => { dummy.position.set(x, field.h(x, z), z); dummy.rotation.set(0, rnd() * 6, 0); dummy.scale.setScalar(0.8 + rnd() * 0.6); dummy.updateMatrix(); bm.setMatrixAt(i, dummy.matrix); });
    const mm = inst(K.mahogany(), matV, mahog.length);
    mahog.forEach(([x, z], i) => { dummy.position.set(x, field.h(x, z), z); dummy.rotation.set(0, rnd() * 6, 0); dummy.scale.setScalar(0.85 + rnd() * 0.35); dummy.updateMatrix(); mm.setMatrixAt(i, dummy.matrix); });
    out.trees = { palms: palms.length, trees: trees.length, bushes: bushes.length, mahogany: mahog.length };
  }

  // ------------------------------------------------------------- boats
  {
    const fleet = [];
    const add = (x, z, rot, trim) => fleet.push({ x, z, rot, trim, ph: rnd() * 6.28, s: 0.42 + rnd() * 0.08 });
    function moor(key, n, dist, spread) {
      const [x0, z0] = P(key);
      const [sx, sz] = field.seek(x0, z0, -dist);
      const [gx, gz] = field.grad(sx, sz);
      for (let i = 0; i < n; i++) {
        const t = (i - (n - 1) / 2) * spread;
        const x = sx - gz * t + (rnd() - 0.5) * 0.4, z = sz + gx * t + (rnd() - 0.5) * 0.4;
        if (field.sd(x, z) > -0.8) continue;
        add(x, z, Math.atan2(gx, gz) + (rnd() - 0.5) * 0.6, rnd() < 0.5 ? '#2F7FB6' : '#C94F3D');
      }
    }
    moor('whaleshark', 9, 2.6, 0.75);   // whale-shark watching boats line up
    moor('panagsama', 6, 1.9, 1.1);
    moor('alona', 8, 1.5, 0.9);
    moor('balicasag', 4, 1.8, 1.4);
    moor('momo', 3, 1.2, 1.0);
    moor('quartel', 3, 1.2, 0.9);
    moor('virgin', 3, 1.4, 1.0);
    const geoA = K.banca('#2F7FB6'), geoB = K.banca('#C94F3D');
    const A = fleet.filter(b => b.trim === '#2F7FB6'), Bf = fleet.filter(b => b.trim !== '#2F7FB6');
    const ma = inst(geoA, matV, A.length), mb = inst(geoB, matV, Bf.length);
    const place = (m, list, t) => {
      list.forEach((b, i) => {
        dummy.position.set(b.x, 0.02 + Math.sin(t * 1.3 + b.ph) * 0.025, b.z);
        dummy.rotation.set(Math.sin(t * 0.9 + b.ph) * 0.03, b.rot, Math.sin(t * 1.1 + b.ph * 2) * 0.05);
        dummy.scale.setScalar(b.s * Math.min(vk, 1.8)); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    };
    place(ma, A, 0); place(mb, Bf, 0);
    out.updaters.push((dt, t) => { lastT = t; place(ma, A, t); place(mb, Bf, t); });
    out.placeFleet = () => { place(ma, A, lastT); place(mb, Bf, lastT); };
    out.bancas = fleet;
    // docked ferries
    const fg = K.ferry();
    for (const pr of [p1, ptag]) {
      const m = new THREE.Mesh(fg, matV); m.scale.setScalar(0.5); scalables.push({ obj: m, base: 0.5, cap: 3 });
      m.position.set(pr.x + Math.cos(pr.a) * 0.45, 0.02, pr.z - Math.sin(pr.a) * 0.45); m.rotation.y = pr.a; m.castShadow = castShadow; scene.add(m);
    }
    // moving boats on the trip's sea routes
    function mover(geom, scale, routes, speed, y = 0.02) {
      const pts = routes.map(([x, z]) => new THREE.Vector3(x, y, z));
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const len = curve.getLength();
      const m = new THREE.Mesh(geom, matV); m.scale.setScalar(scale); m.castShadow = castShadow; scene.add(m);
      scalables.push({ obj: m, base: scale, cap: 99 });
      let u = rnd(), dir = 1, wait = 0;
      out.updaters.push((dt, t) => {
        if (wait > 0) { wait -= dt; } else {
          u += dir * dt * speed / len;
          if (u > 1) { u = 1; dir = -1; wait = 6; } if (u < 0) { u = 0; dir = 1; wait = 6; }
        }
        const p = curve.getPoint(u), tg = curve.getTangent(u);
        m.position.set(p.x, y + Math.sin(t * 1.4) * 0.02, p.z);
        m.rotation.set(0, Math.atan2(tg.x * dir, tg.z * dir), Math.sin(t * 1.2) * 0.03);
      });
      return m;
    }
    const sea = (day, idx) => geo.routes[day].filter(r => r.mode === 'sea')[idx].pts;
    mover(fg, 0.42, sea('d1208', 0), 1.1);
    mover(geoB, 0.46, sea('d1205', 0), 1.0);      // 12/5 crossing is a bangka (per itinerary)
    mover(geoA, 0.42, sea('d1206', 0), 0.7);      // 12/6 跳島包船
    mover(fg, 0.38, sea('d1207', 0), 1.2);        // 12/7 Lance 團回宿霧
  }

  // ------------------------------------------------------------- vans on today's road
  {
    const vg = K.van();
    const road = (day) => geo.routes[day].filter(r => r.mode === 'land')[0].pts;
    function car(day, speed, phase, color) {
      const pts = road(day).map(([x, z]) => new THREE.Vector3(x, 0, z));
      if (pts.length < 2) return;
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const len = curve.getLength();
      const m = new THREE.Mesh(vg, matV); m.scale.setScalar(0.85); m.castShadow = castShadow; scene.add(m);
      scalables.push({ obj: m, base: 0.85, cap: 99 });
      let u = phase, dir = 1;
      out.updaters.push((dt) => {
        u += dir * dt * speed / len; if (u > 1) { u = 1; dir = -1; } if (u < 0) { u = 0; dir = 1; }
        const p = curve.getPoint(u), tg = curve.getTangent(u);
        m.position.set(p.x, field.h(p.x, p.z) + 0.04, p.z); m.rotation.y = Math.atan2(tg.x * dir, tg.z * dir);
      });
    }
    car('d1204', 0.9, 0.1); car('d1204', 0.9, 0.13);   // two premium vans
    car('d1207', 0.8, 0.4);
    car('d1203', 0.6, 0.5);
    car('d1205', 0.6, 0.2);
    car('d1208', 0.7, 0.6);
  }

  // ----------------------------------------------- STARLUX widebody over Cebu City
  // Decorative orbit only — not a real flight path. Livery checked against
  // official fleet photos (Wikimedia Commons, 2026-10-26).
  {
    const [ax, az] = P('holidayinn');            // the Cebu City anchor the 12/3 marker uses
    const CX = ax - 2.0, CZ = az + 1.5, A = 16.5, B = 11.0, ALT = 9.6, PERIOD = 44;
    const planeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, flatShading: true,
      emissive: new THREE.Color('#9FB4CC'), emissiveIntensity: 0 });
    out.nightMats.planeBody = planeMat;
    const plane = new THREE.Mesh(K.starluxPlane(), planeMat);
    plane.castShadow = false; plane.frustumCulled = false; scene.add(plane);
    const navMat = new THREE.MeshStandardMaterial({ color: '#F3F6F8', emissive: new THREE.Color('#FFF3DC'), emissiveIntensity: 0, roughness: 0.4 });
    const redMat = new THREE.MeshStandardMaterial({ color: '#F6D8D4', emissive: new THREE.Color('#FF4A3A'), emissiveIntensity: 0, roughness: 0.4 });
    const grnMat = new THREE.MeshStandardMaterial({ color: '#D6F3DC', emissive: new THREE.Color('#3BE07A'), emissiveIntensity: 0, roughness: 0.4 });
    const L = K.planeLights();
    const lr = new THREE.Mesh(L.red, redMat), lg = new THREE.Mesh(L.green, grnMat), lt = new THREE.Mesh(L.tail, navMat);
    [lr, lg, lt].forEach(m => { m.frustumCulled = false; plane.add(m); });
    out.nightMats.nav = navMat; out.nightMats.navR = redMat; out.nightMats.navG = grnMat;

    let scale = 5.0, wantScale = 5.0, prevHead = null, roll = 0, ang0 = Math.PI * 0.35;
    out.setPlaneScale = (v) => { wantScale = v; };
    out.updaters.push((dt, t) => {
      const ang = ang0 + (t / PERIOD) * Math.PI * 2;
      const x = CX + Math.cos(ang) * A, z = CZ + Math.sin(ang) * B;
      const head = Math.atan2(-Math.sin(ang) * A, Math.cos(ang) * B);
      if (prevHead === null) prevHead = head;
      let d = head - prevHead; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      const rate = dt > 1e-4 ? d / dt : 0;
      prevHead = head;
      roll += (Math.max(-0.42, Math.min(0.42, -rate * 1.5)) - roll) * Math.min(1, dt * 1.6);
      scale += (wantScale - scale) * Math.min(1, dt * 2.2);
      plane.position.set(x, ALT + Math.sin(t * 0.33) * 0.22, z);
      plane.rotation.set(Math.sin(t * 0.27) * 0.015, head, roll, 'YXZ');
      plane.scale.setScalar(scale);
    });
    out.plane = plane;
  }

  out.update = (dt, t) => { for (const f of out.updaters) f(dt, t); };
  // keep boats / ferries / vans readable from the overview: grow with camera distance
  out.setScale = (k) => {
    vk = k;
    for (const o of scalables) o.obj.scale.setScalar(o.base * Math.min(k, o.cap));
    if (out.placeFleet) out.placeFleet();
  };
  return out;
}
