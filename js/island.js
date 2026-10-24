// Cebu × Bohol — explorable miniature island.
// Loaded as an ES module; the page (index.html) works fully without it.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GEO } from './geo-data.js';
import { Field, Obstacles, mulberry32, BEACH_W } from './field.js';
import { buildProps, townBumps } from './props.js';
import { buildLife } from './life.js';

const DEG = Math.PI / 180;

function detectTier() {
  const q = new URLSearchParams(location.search).get('q');
  if (q === 'low' || q === 'mid' || q === 'high') return q;
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  const coarse = matchMedia('(pointer:coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 500;
  if (cores <= 4 || mem <= 3) return 'low';
  if (coarse || small) return 'mid';
  return 'high';
}

// Lighting presets for the four time-of-day phases (Asia/Taipei clock decided by the page)
const LOOK = {
  dawn:  { skyTop: '#F0B9B0', skyHor: '#FFE4CF', fog: '#F8DCCB', sea: '#6CB9C4', seaOp: 0.58, hemiSky: '#FFE6DA', hemiGnd: '#86AEBB', hemi: 1.95, sun: '#FFC29A', sunI: 2.2, glow: 0.5, sunDir: [0.85, 0.42, 0.3], shadow: 0.6, win: 0.5, bulb: 0.8, stars: 0.05, floor: 1.0 },
  day:   { skyTop: '#A9D9E6', skyHor: '#F1F4EA', fog: '#EEF2E8', sea: '#3FB2B6', seaOp: 0.56, hemiSky: '#FFFFFF', hemiGnd: '#8FAF95', hemi: 1.25, sun: '#FFF4E2', sunI: 2.5, glow: 0.3, sunDir: [0.42, 1.0, 0.62], shadow: 0.85, win: 0.0, bulb: 0.0, stars: 0.0, floor: 1.0 },
  dusk:  { skyTop: '#7B6FA8', skyHor: '#FFB08A', fog: '#EFB797', sea: '#4A93AA', seaOp: 0.62, hemiSky: '#FFD4BC', hemiGnd: '#6A74A4', hemi: 1.65, sun: '#FF9454', sunI: 2.6, glow: 0.45, sunDir: [-0.85, 0.38, 0.35], shadow: 0.62, win: 0.9, bulb: 1.5, stars: 0.12, floor: 0.88 },
  night: { skyTop: '#0D1830', skyHor: '#253A63', fog: '#1E2F52', sea: '#164A66', seaOp: 0.7, hemiSky: '#5A72AD', hemiGnd: '#121B30', hemi: 0.62, sun: '#A9BCFF', sunI: 0.55, glow: 0.22, sunDir: [-0.3, 0.95, 0.45], shadow: 0.42, win: 1.35, bulb: 2.2, stars: 0.9, floor: 0.55 },
};

export async function init(opts) {
  const { canvas, markers = [], onReady, onFrameMarkers, reducedMotion } = opts;
  const tier = detectTier();
  const t0 = performance.now();

  /* ---------------- renderer / scene / camera ---------------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'low', powerPreference: 'high-performance', alpha: false });
  if (!renderer.getContext()) throw new Error('no webgl');
  const maxDpr = tier === 'high' ? 2 : tier === 'mid' ? 1.5 : 1.1;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = tier !== 'low';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#EEF2E8', 150, 380);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 2500);

  const field = new Field(GEO);
  const obst = new Obstacles(1.5);

  townBumps(field);

  /* ---------------- terrain ---------------- */
  const step = tier === 'low' ? 2 : 1;
  const nx = Math.floor((field.nx - 1) / step) + 1, nz = Math.floor((field.nz - 1) / step) + 1;
  {
    const pos = new Float32Array(nx * nz * 3), colr = new Float32Array(nx * nz * 3);
    const C = {
      deep: new THREE.Color('#2B7E93'), mid: new THREE.Color('#5EC0BC'), shallow: new THREE.Color('#BFE6D2'), wet: new THREE.Color('#E3D6A6'),
      sand: new THREE.Color('#F0DDAA'), g1: new THREE.Color('#AFCB6D'), g2: new THREE.Color('#93BE5E'), g3: new THREE.Color('#78AC52'), g4: new THREE.Color('#5F9447'), rock: new THREE.Color('#5C8A47'),
    };
    const c = new THREE.Color();
    const rnd = mulberry32(7);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = field.x0 + i * step * field.res, z = field.z0 + j * step * field.res;
      const s = field.sdv[(j * step) * field.nx + i * step];
      const h = field.h(x, z, s);
      const k = (j * nx + i) * 3;
      pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
      if (s < 0) {
        const d = Math.min(1, -s / 6);
        if (d < 0.08) c.copy(C.wet).lerp(C.shallow, d / 0.08);
        else if (d < 0.35) c.copy(C.shallow).lerp(C.mid, (d - 0.08) / 0.27);
        else c.copy(C.mid).lerp(C.deep, Math.min(1, (d - 0.35) / 0.65));
      } else if (s < BEACH_W) c.copy(C.sand);
      else {
        const lv = h;
        if (lv < 0.75) c.copy(C.g1); else if (lv < 1.3) c.copy(C.g2); else if (lv < 2.2) c.copy(C.g3); else if (lv < 3.3) c.copy(C.g4); else c.copy(C.rock);
        const n = (rnd() - 0.5) * 0.05; c.r += n; c.g += n; c.b += n * 0.5;
      }
      colr[k] = c.r; colr[k + 1] = c.g; colr[k + 2] = c.b;
    }
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
    let q = 0;
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, cc = a + nx, d = cc + 1;
      if ((i + j) & 1) { idx[q++] = a; idx[q++] = cc; idx[q++] = b; idx[q++] = b; idx[q++] = cc; idx[q++] = d; }
      else { idx[q++] = a; idx[q++] = cc; idx[q++] = d; idx[q++] = a; idx[q++] = d; idx[q++] = b; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    var terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, flatShading: true });
    const terrain = new THREE.Mesh(g, terrainMat);
    terrain.receiveShadow = true; scene.add(terrain);
    // far sea floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2B7E93', roughness: 1 }));
    floor.position.y = -3.62; scene.add(floor);
    var floorMat = floor.material;
  }

  /* ---------------- water + shore foam ---------------- */
  const waterMat = new THREE.MeshStandardMaterial({ color: '#3FB2B6', transparent: true, opacity: 0.56, roughness: 0.28, metalness: 0.02, depthWrite: false });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), waterMat);
  water.renderOrder = 2; scene.add(water);
  {
    const fs = 2, fnx = Math.floor((field.nx - 1) / fs) + 1, fnz = Math.floor((field.nz - 1) / fs) + 1;
    const pos = new Float32Array(fnx * fnz * 3), col = new Float32Array(fnx * fnz * 4);
    for (let j = 0; j < fnz; j++) for (let i = 0; i < fnx; i++) {
      const x = field.x0 + i * fs * field.res, z = field.z0 + j * fs * field.res, s = field.sdv[(j * fs) * field.nx + i * fs];
      const k = j * fnx + i;
      pos[k * 3] = x; pos[k * 3 + 1] = 0.02; pos[k * 3 + 2] = z;
      const a = Math.max(0, 1 - Math.abs(s + 0.35) / 0.42);
      col[k * 4] = 1; col[k * 4 + 1] = 1; col[k * 4 + 2] = 1; col[k * 4 + 3] = a * 0.9;
    }
    const idx = [];
    for (let j = 0; j < fnz - 1; j++) for (let i = 0; i < fnx - 1; i++) { const a = j * fnx + i; idx.push(a, a + fnx, a + 1, a + 1, a + fnx, a + fnx + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    g.setIndex(idx);
    var foamMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, opacity: 0.7 });
    const foam = new THREE.Mesh(g, foamMat); foam.renderOrder = 3; scene.add(foam);
  }

  /* ---------------- sky + stars ---------------- */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#A9D9E6') }, hor: { value: new THREE.Color('#F1F4EA') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float t = clamp(vP.y*1.6, 0.0, 1.0); gl_FragColor = vec4(mix(hor, top, t), 1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 24, 12), skyMat); scene.add(sky);
  const starGeo = new THREE.BufferGeometry(); {
    const r = mulberry32(99), p = [];
    for (let i = 0; i < 700; i++) { const a = r() * Math.PI * 2, e = 0.06 + r() * 1.2; p.push(Math.cos(a) * Math.cos(e) * 1500, Math.sin(e) * 1500, Math.sin(a) * Math.cos(e) * 1500); }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  }
  const starMat = new THREE.PointsMaterial({ color: '#FFFFFF', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  scene.add(new THREE.Points(starGeo, starMat));

  /* ---------------- lights ---------------- */
  const hemi = new THREE.HemisphereLight('#FFFFFF', '#8FAF95', 1.2); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#FFF4E2', 2.4);
  sun.castShadow = renderer.shadowMap.enabled;
  sun.shadow.mapSize.set(tier === 'high' ? 2048 : 1024, tier === 'high' ? 2048 : 1024);
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  // a few warm point lights that only wake at dusk / night
  const pointLights = [];

  /* ---------------- props + life ---------------- */
  const reserved = [];
  for (const [key, r, smax] of [['alona', 3.4, 1.15], ['panagsama', 3.0, 1.1], ['quartel', 3.0, 1.1], ['cebuwalk', 2.6, 1.3]]) {
    const [x, z] = GEO.places[key]; const [sx, sz] = field.seek(x, z, 0.55); reserved.push({ x: sx, z: sz, r, smax });
  }
  const ctx = { scene, field, obst, tier, geo: GEO, reserved };
  const props = buildProps(ctx);
  if (tier !== 'low') for (const [x, z] of props.lampSpots.slice(0, 6)) {
    const L = new THREE.PointLight('#FFC67A', 0, 7, 1.6); L.position.set(x, 1.2, z); scene.add(L); pointLights.push(L);
  }
  const life = buildLife(ctx);

  /* ---------------- trip routes ---------------- */
  const routes = {};
  {
    const dashGeo = new THREE.BoxGeometry(0.09, 0.03, 0.24);
    for (const day in GEO.routes) {
      const pts = [];
      for (const seg of GEO.routes[day]) {
        const curve = new THREE.CatmullRomCurve3(seg.pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
        const L = curve.getLength(), n = Math.max(2, Math.floor(L / 0.5));
        for (let i = 0; i <= n; i++) {
          const u = i / n, p = curve.getPointAt(u), tg = curve.getTangentAt(u);
          const y = seg.mode === 'sea' ? 0.07 : Math.max(0.05, field.h(p.x, p.z)) + 0.1;
          pts.push({ x: p.x, y, z: p.z, a: Math.atan2(tg.x, tg.z), sea: seg.mode === 'sea' });
        }
      }
      const mat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.0, depthWrite: false });
      const m = new THREE.InstancedMesh(dashGeo, mat, pts.length);
      m.renderOrder = 4; m.frustumCulled = false; scene.add(m);
      routes[day] = { mesh: m, mat, pts, target: 0.9 };
    }
  }
  // dashes grow with camera distance (and thin out) so routes stay visible from the overview
  let viewK = 0;
  const dd = new THREE.Object3D();
  function layoutRoutes(k) {
    const stride = Math.max(1, Math.round(k * 0.75));
    const len = Math.min(k, stride * 0.5 * 0.62 / 0.24);
    for (const day in routes) {
      const R = routes[day];
      R.pts.forEach((p, i) => {
        dd.position.set(p.x, p.y + (k - 1) * 0.02, p.z); dd.rotation.set(0, p.a, 0);
        if (i % stride) dd.scale.set(0.0001, 0.0001, 0.0001); else dd.scale.set(k * 1.8, Math.max(1, k * 0.6), len);
        dd.updateMatrix(); R.mesh.setMatrixAt(i, dd.matrix);
      });
      R.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  function updateZoomScale() {
    const dist = camera.position.distanceTo(controls.target);
    const k = Math.min(5.5, Math.max(1, Math.pow(dist / 24, 0.9)));
    if (Math.abs(k - viewK) / Math.max(viewK, 1e-3) < 0.03) return false;
    viewK = k; layoutRoutes(k); props.setScale(k);
    return true;
  }
  let selectedDay = null;
  function setSelected(day) {
    selectedDay = day;
    for (const k in routes) {
      routes[k].target = !day ? 0.9 : (k === day ? 1 : 0.35);
      routes[k].mat.color.set(k === day ? '#E8673A' : '#FFFFFF');
    }
    need = true;
  }

  /* ---------------- controls ---------------- */
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.09;
  controls.screenSpacePanning = false;
  controls.minDistance = 4; controls.maxDistance = 300;
  controls.minPolarAngle = 18 * DEG; controls.maxPolarAngle = 64 * DEG;
  controls.minAzimuthAngle = -60 * DEG; controls.maxAzimuthAngle = 60 * DEG;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.zoomToCursor = true;
  controls.panSpeed = 1.1;
  controls.keyPanSpeed = 70;
  controls.listenToKeyEvents(canvas);

  const view = (id) => {
    const v = GEO.views[id];
    if (id === 'overview') {
      // fit all six destinations to the current viewport shape
      const vt = Math.tan(camera.fov * DEG / 2), ht = vt * camera.aspect;
      const r = Math.min(camera.aspect < 0.8 ? 295 : 245, Math.max(v.dist * 0.9, 45 / ht, 60 / vt * 0.8));
      return { t: new THREE.Vector3(...v.t), r, phi: v.pol * DEG, theta: v.az * DEG };
    }
    const m = GEO.markers.find(m => m.id === id);
    let [tx, tz] = [m.x, m.z];
    if (v.sd !== undefined) [tx, tz] = field.seek(m.x, m.z, v.sd);   // centre on the shoreline / water where the day happens
    const fit = camera.aspect < 0.8 ? 1.35 : 1;                         // portrait phones need a little more room
    return { t: new THREE.Vector3(tx, 0, tz), r: v.dist * fit, phi: v.pol * DEG, theta: v.az * DEG };
  };
  function placeCamera(t, r, phi, theta) {
    controls.target.copy(t);
    camera.position.set(t.x + r * Math.sin(phi) * Math.sin(theta), t.y + r * Math.cos(phi), t.z + r * Math.sin(phi) * Math.cos(theta));
    camera.lookAt(t);
  }
  { const r0 = canvas.getBoundingClientRect(); camera.aspect = Math.max(1, r0.width) / Math.max(1, r0.height); camera.fov = r0.width < 700 ? 38 : 30; camera.updateProjectionMatrix(); }
  const o = view('overview'); placeCamera(o.t, o.r, o.phi, o.theta);

  const clampTarget = () => {
    const t = controls.target;
    t.x = Math.max(-52, Math.min(84, t.x)); t.z = Math.max(-62, Math.min(54, t.z)); t.y = 0;
  };
  let tween = null, need = true;
  controls.addEventListener('change', () => { clampTarget(); need = true; });
  controls.addEventListener('start', () => { tween = null; controls.enableDamping = true; opts.onUserMove && opts.onUserMove(); });

  function current() {
    const off = camera.position.clone().sub(controls.target);
    const r = off.length();
    return { t: controls.target.clone(), r, phi: Math.acos(Math.min(1, Math.max(-1, off.y / r))), theta: Math.atan2(off.x, off.z) };
  }
  function flyTo(id, instant) {
    const to = view(id);
    if (instant || reducedMotion()) { tween = null; placeCamera(to.t, to.r, to.phi, to.theta); controls.update(); need = true; return; }
    const from = current();
    let dth = to.theta - from.theta; while (dth > Math.PI) dth -= 2 * Math.PI; while (dth < -Math.PI) dth += 2 * Math.PI;
    const dist = from.t.distanceTo(to.t);
    // latest request always wins: replacing the tween object drops the old one completely
    tween = { from, to, dth, u: 0, dur: Math.min(2.4, 1.1 + dist / 70), lift: Math.min(60, dist * 0.5) };
    controls.enableDamping = false;
    need = true;
  }
  const ease = (u) => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  function stepTween(dt) {
    if (!tween) return false;
    tween.u = Math.min(1, tween.u + dt / tween.dur);
    const e = ease(tween.u), f = tween.from, to = tween.to;
    const t = f.t.clone().lerp(to.t, e);
    const r = f.r + (to.r - f.r) * e + Math.sin(Math.PI * e) * tween.lift;
    placeCamera(t, r, f.phi + (to.phi - f.phi) * e, f.theta + tween.dth * e);
    if (tween.u >= 1) { tween = null; controls.enableDamping = true; controls.update(); }
    return true;
  }

  /* ---------------- view offset (keep focus clear of the reading panel) ---------------- */
  const inset = { r: 0, b: 0, tr: 0, tb: 0 };
  function setInsets(r, b) { inset.tr = r || 0; inset.tb = b || 0; need = true; }
  let W = 1, H = 1;
  function applyOffset() {
    if (Math.abs(inset.r) < 0.5 && Math.abs(inset.b) < 0.5) camera.clearViewOffset();
    else camera.setViewOffset(W, H, inset.r / 2, inset.b / 2, W, H);
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = W < 700 ? 38 : 30;
    camera.updateProjectionMatrix(); applyOffset(); camera.updateProjectionMatrix();
    need = true;
  }
  new ResizeObserver(resize).observe(canvas); resize();

  /* ---------------- phases ---------------- */
  const cur = {}; const tgt = {};
  const colorKeys = ['skyTop', 'skyHor', 'fog', 'sea', 'hemiSky', 'hemiGnd', 'sun'];
  const numKeys = ['seaOp', 'hemi', 'sunI', 'shadow', 'win', 'bulb', 'stars', 'floor', 'glow'];
  function loadLook(dst, key) {
    const L = LOOK[key];
    for (const k of colorKeys) { dst[k] = dst[k] || new THREE.Color(); dst[k].set(L[k]); }
    for (const k of numKeys) dst[k] = L[k];
    dst.sunDir = dst.sunDir || new THREE.Vector3(); dst.sunDir.set(...L.sunDir).normalize();
  }
  loadLook(cur, 'day'); loadLook(tgt, 'day');
  let phaseKey = 'day', phaseBlend = 1;
  function setPhase(key, instant) {
    if (!LOOK[key]) return;
    phaseKey = key; loadLook(tgt, key);
    if (instant || reducedMotion()) { loadLook(cur, key); phaseBlend = 1; applyLook(); } else phaseBlend = 0;
    need = true;
  }
  function stepPhase(dt) {
    if (phaseBlend >= 1) return false;
    const k = 1 - Math.exp(-dt * 1.3);
    for (const c of colorKeys) cur[c].lerp(tgt[c], k);
    for (const n of numKeys) cur[n] += (tgt[n] - cur[n]) * k;
    cur.sunDir.lerp(tgt.sunDir, k).normalize();
    phaseBlend = Math.min(1, phaseBlend + dt / 3.2);
    if (phaseBlend >= 1) loadLook(cur, phaseKey);
    return true;
  }
  const floorBase = new THREE.Color('#2B7E93');
  function applyLook() {
    skyMat.uniforms.top.value.copy(cur.skyTop); skyMat.uniforms.hor.value.copy(cur.skyHor);
    scene.fog.color.copy(cur.fog); scene.background = cur.fog;
    waterMat.color.copy(cur.sea); waterMat.opacity = cur.seaOp; waterMat.emissive.copy(cur.sea).multiplyScalar(cur.glow);
    hemi.color.copy(cur.hemiSky); hemi.groundColor.copy(cur.hemiGnd); hemi.intensity = cur.hemi;
    sun.color.copy(cur.sun); sun.intensity = cur.sunI;
    sun.shadow.intensity = cur.shadow;
    props.nightMats.win.emissiveIntensity = cur.win; props.nightMats.bulb.emissiveIntensity = cur.bulb;
    for (const L of pointLights) L.intensity = cur.bulb * 2.2;
    starMat.opacity = cur.stars;
    floorMat.color.copy(floorBase).multiplyScalar(cur.floor);
    foamMat.color.setScalar(0.55 + cur.floor * 0.45);
  }
  function placeSun() {
    const t = controls.target, dist = camera.position.distanceTo(t);
    scene.fog.near = Math.max(110, dist * 1.35); scene.fog.far = Math.max(340, dist * 3.6);
    const half = Math.min(70, Math.max(10, dist * 0.55));
    sun.position.copy(t).addScaledVector(cur.sunDir, 120);
    sun.target.position.copy(t);
    const sc = sun.shadow.camera;
    if (sc.right !== half) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 1; sc.far = 300; sc.updateProjectionMatrix(); }
  }

  /* ---------------- markers ---------------- */
  const mk = GEO.markers.map(m => ({ ...m, el: markers.find(e => e.dataset.marker === m.id), v: new THREE.Vector3(m.x, Math.max(0.3, field.h(m.x, m.z)) + 1.0, m.z) }));
  const tmp = new THREE.Vector3();
  function placeMarkers() {
    const vis = [];
    for (const m of mk) {
      if (!m.el) continue;
      tmp.copy(m.v).project(camera);
      m.sx = (tmp.x * 0.5 + 0.5) * W; m.sy = (-tmp.y * 0.5 + 0.5) * H;
      m.off = tmp.z > 1 || m.sx < -80 || m.sx > W + 80 || m.sy < -40 || m.sy > H + 60;
      if (!m.w) { const p = m.el.firstElementChild; m.w = p ? p.offsetWidth : 110; m.hh = p ? p.offsetHeight : 40; }
      if (!m.off) vis.push(m);
    }
    // keep labels from covering each other: lift the one further north
    vis.sort((a, b) => b.sy - a.sy);
    for (let i = 0; i < vis.length; i++) for (let j = 0; j < i; j++) {
      const a = vis[i], b = vis[j];
      if (Math.abs(a.sx - b.sx) < (a.w + b.w) / 2 + 4 && a.sy > b.sy - b.hh - 4) a.sy = b.sy - b.hh - 4;
    }
    for (const m of mk) {
      if (!m.el) continue;
      m.el.style.transform = `translate3d(${m.sx.toFixed(1)}px, ${m.sy.toFixed(1)}px, 0)`;
      m.el.classList.toggle('off', m.off);
    }
    onFrameMarkers && onFrameMarkers();
  }

  /* ---------------- loop ---------------- */
  let paused = !!reducedMotion(), last = performance.now(), simT = 0, raf = 0, slow = 0, frames = 0, degraded = false;
  const perf = { fps: 0 };
  function degrade() {
    if (degraded) return; degraded = true;
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false; sun.castShadow = false;
    scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    life.setFishCount(200);
    resize();
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const raw = Math.max(0, (now - last) / 1000), dt = Math.min(0.05, raw), dtw = Math.min(0.25, raw); last = Math.max(last, now);
    let moving = stepTween(dtw);
    if (controls.update()) moving = true;
    if (stepPhase(dtw)) { applyLook(); moving = true; }
    if (Math.abs(inset.r - inset.tr) > 0.3 || Math.abs(inset.b - inset.tb) > 0.3) {
      const k = reducedMotion() ? 1 : 1 - Math.exp(-dtw * 7);
      inset.r += (inset.tr - inset.r) * k; inset.b += (inset.tb - inset.b) * k;
      applyOffset(); camera.updateProjectionMatrix(); moving = true;
    }
    for (const k in routes) {
      const R = routes[k], goal = R.target;
      const op = R.mat.opacity + (goal - R.mat.opacity) * Math.min(1, dt * 4);
      if (Math.abs(op - R.mat.opacity) > 0.002) { R.mat.opacity = op; moving = true; }
      R.mesh.visible = R.mat.opacity > 0.01;
    }
    if (!paused) {
      simT += dt;
      props.update(dt, simT);
      life.update(dt, simT, camera, controls.target);
      foamMat.opacity = 0.55 + Math.sin(simT * 0.9) * 0.2;
      if (selectedDay && routes[selectedDay]) {
        const R = routes[selectedDay];
        R.mat.color.setHSL(0.045, 0.82, 0.55 + Math.sin(simT * 3) * 0.06);
      }
      moving = true;
      // runtime performance guard
      frames++; slow += dt;
      if (frames === 150) { perf.fps = 150 / slow; if (perf.fps < 26 && !degraded) degrade(); frames = 0; slow = 0; }
    }
    if (updateZoomScale()) moving = true;
    if (moving || need) {
      placeSun();
      renderer.render(scene, camera);
      placeMarkers();
      need = false;
    }
  }
  applyLook();
  raf = requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { last = performance.now(); need = true; });

  const api = {
    tier,
    flyTo, setInsets, setSelected, setPhase,
    setPaused(v) { paused = !!v; need = true; return paused; },
    get paused() { return paused; },
    people: life.list,
    focusPerson(id, instant) {
      const p = life.people.find(p => p.c.id === id); if (!p) return;
      const from = current();
      const to = { t: new THREE.Vector3(p.x, 0, p.z), r: 9.5, phi: 50 * DEG, theta: from.theta };
      if (instant || reducedMotion()) { tween = null; placeCamera(to.t, to.r, to.phi, to.theta); need = true; return; }
      tween = { from, to, dth: 0, u: 0, dur: 1.6, lift: 4 };
      controls.enableDamping = false; need = true;
    },
    zoom(f) { const c = current(); tween = null; placeCamera(c.t, Math.max(controls.minDistance, Math.min(controls.maxDistance, c.r * f)), c.phi, c.theta); need = true; },
    stats() {
      return {
        tier, degraded, fps: perf.fps, loadMs: Math.round(performance.now() - t0), props: props.counts, trees: props.trees, hills: props.hills,
        life: life.counts(), people: life.list, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
        camera: { target: controls.target.toArray().map(v => +v.toFixed(2)), dist: +camera.position.distanceTo(controls.target).toFixed(2) },
        phase: phaseKey, inset: { ...inset },
      };
    },
    _debug: { scene, camera, controls, field, life, props, renderer, GEO },
  };
  onReady && onReady(api);
  return api;
}
