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
  try {                                   // a quality level the reader picked by hand
    const saved = localStorage.getItem('cebu3d-quality');
    if (saved === 'low' || saved === 'mid' || saved === 'high') return saved;
  } catch (e) { /* private mode: fall through to auto-detect */ }
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  const coarse = matchMedia('(pointer:coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 500;
  if (cores <= 4 || mem <= 3) return 'low';
  if (coarse || small) return 'mid';
  return 'high';
}

// Lighting presets for the four time-of-day phases (Cebu / Asia/Manila clock decided by the page)
const LOOK = {
  dawn:  { skyTop: '#F0B9B0', skyHor: '#FFE4CF', fog: '#F8DCCB', sea: '#6CB9C4', seaOp: 0.58, hemiSky: '#FFE6DA', hemiGnd: '#86AEBB', hemi: 1.95, sun: '#FFC29A', sunI: 2.2, glow: 0.5, sunDir: [0.85, 0.42, 0.3], shadow: 0.6, win: 0.5, bulb: 0.8, stars: 0.05, floor: 1.0, nav: 0.55 },
  day:   { skyTop: '#A9D9E6', skyHor: '#F1F4EA', fog: '#EEF2E8', sea: '#3FB2B6', seaOp: 0.56, hemiSky: '#FFFFFF', hemiGnd: '#8FAF95', hemi: 1.25, sun: '#FFF4E2', sunI: 2.5, glow: 0.3, sunDir: [0.42, 1.0, 0.62], shadow: 0.85, win: 0.0, bulb: 0.0, stars: 0.0, floor: 1.0, nav: 0.0 },
  dusk:  { skyTop: '#7B6FA8', skyHor: '#FFB08A', fog: '#EFB797', sea: '#4A93AA', seaOp: 0.62, hemiSky: '#FFD4BC', hemiGnd: '#6A74A4', hemi: 1.65, sun: '#FF9454', sunI: 2.6, glow: 0.45, sunDir: [-0.85, 0.38, 0.35], shadow: 0.62, win: 0.9, bulb: 1.5, stars: 0.12, floor: 0.88, nav: 1.1 },
  night: { skyTop: '#0D1830', skyHor: '#253A63', fog: '#1E2F52', sea: '#164A66', seaOp: 0.7, hemiSky: '#5A72AD', hemiGnd: '#121B30', hemi: 0.62, sun: '#A9BCFF', sunI: 0.55, glow: 0.22, sunDir: [-0.3, 0.95, 0.45], shadow: 0.42, win: 1.35, bulb: 2.2, stars: 0.9, floor: 0.55, nav: 1.7 },
};

export async function init(opts) {
  const { canvas, markers = [], onReady, onFrameMarkers, reducedMotion } = opts;
  const safeTop = opts.safeTop || (() => 0);   // labels never slide under the page header
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

  /* ---------------- shared depth texture ----------------
     The island's signed-distance grid, uploaded once as a small single-channel
     texture. Both the sea shader and the terrain shader read it, so depth-aware
     colour, transparency and wet-sand roughness all cost one texture between them. */
  const sdTex = (() => {
    const n = field.nx * field.nz, data = new Uint8Array(n);
    for (let i = 0; i < n; i++) data[i] = Math.max(0, Math.min(255, Math.round(field.sdv[i] * 8 + 128)));
    const t = new THREE.DataTexture(data, field.nx, field.nz, THREE.RedFormat, THREE.UnsignedByteType);
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  })();
  const sdBnd = new THREE.Vector4(field.x0, field.z0, 1 / (field.x1 - field.x0), 1 / (field.z1 - field.z0));
  const terrU = { tSD: { value: sdTex }, tBnd: { value: sdBnd } };

  /* ---------------- terrain ---------------- */
  const step = tier === 'low' ? 2 : 1;
  const nx = Math.floor((field.nx - 1) / step) + 1, nz = Math.floor((field.nz - 1) / step) + 1;
  {
    const pos = new Float32Array(nx * nz * 3), colr = new Float32Array(nx * nz * 3);
    // Sea floor and land ramps. The water sheet is now depth-graded and nearly
    // clear in the shallows, so the floor has to carry the near-shore colour
    // itself: wet sand, then sand, then seagrass patches, then reef, then deep.
    const C = {
      deep: new THREE.Color('#1F5E74'), reef: new THREE.Color('#2F8491'), grassbed: new THREE.Color('#5E9A86'),
      shallow: new THREE.Color('#C2B486'), wet: new THREE.Color('#DCCB9C'),
      sand: new THREE.Color('#EFDCA8'), sand2: new THREE.Color('#E4CE96'),
      g1: new THREE.Color('#AFCB6D'), g2: new THREE.Color('#93BE5E'), g3: new THREE.Color('#78AC52'), g4: new THREE.Color('#5F9447'),
      rock: new THREE.Color('#7E7A63'),
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
        const d = -s;                                   // units of water
        if (d < 0.35) c.copy(C.wet).lerp(C.shallow, d / 0.35);
        else if (d < 1.1) c.copy(C.shallow).lerp(C.grassbed, (d - 0.35) / 0.75);
        else if (d < 4.0) c.copy(C.grassbed).lerp(C.reef, (d - 1.1) / 2.9);
        else c.copy(C.reef).lerp(C.deep, Math.min(1, (d - 4.0) / 5.5));
        const n = (rnd() - 0.5) * 0.045; c.r += n; c.g += n * 0.8; c.b += n * 0.6;   // patchiness
      } else {
        // land. the beach no longer stops at a hard line: it fades into grass,
        // and steep ground shows rock instead of more green
        const lv = h;
        const g = new THREE.Color();
        if (lv < 0.75) g.copy(C.g1); else if (lv < 1.3) g.copy(C.g2); else if (lv < 2.2) g.copy(C.g3); else g.copy(C.g4);
        const slope = Math.abs(field.h(x + 0.6, z) - field.h(x - 0.6, z)) + Math.abs(field.h(x, z + 0.6) - field.h(x, z - 0.6));
        if (slope > 0.55) g.lerp(C.rock, Math.min(0.72, (slope - 0.55) * 0.9));
        const beach = C.sand.clone().lerp(C.sand2, (rnd() * 0.6 + 0.2));
        const t = Math.min(1, Math.max(0, (s - BEACH_W * 0.45) / (BEACH_W * 1.25)));
        c.copy(beach).lerp(g, t * t * (3 - 2 * t));
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
    // Sand, wet sand, grass and rock should not all reflect light the same way.
    // The shore band is read back from the signed-distance field and given a
    // lower roughness, so wet sand catches the sun the way grass never does.
    var terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, flatShading: true });
    terrainMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, terrU);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTWP;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vTWP = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vTWP; uniform sampler2D tSD; uniform vec4 tBnd;`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
{
  vec2 uv = vec2((vTWP.x-tBnd.x)*tBnd.z, (vTWP.z-tBnd.y)*tBnd.w);
  float sd = (uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) ? -13.0 : (texture2D(tSD, uv).r*255.0-128.0)/8.0;
  float wet = 1.0 - smoothstep(-0.9, 1.1, sd);     // 1 just offshore, 0 inland
  roughnessFactor = mix(roughnessFactor, 0.34, wet * 0.8);
}`);
    };
    const terrain = new THREE.Mesh(g, terrainMat);
    terrain.receiveShadow = true; scene.add(terrain);
    // far sea floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1F5E74', roughness: 1 }));
    floor.position.y = -3.62; scene.add(floor);
    var floorMat = floor.material;
  }

  /* ---------------- water + shore foam ----------------
     The sea used to be one flat semi-transparent sheet, which flattened the whole
     map. It now reads its depth from the island's own signed-distance field
     (uploaded once as a small red-channel texture), so the shallows go pale and
     nearly clear over the sand while the open sea turns deep and opaque. Ripples
     and a surf band are added in the same shader, so this costs one texture and
     no extra draw calls. */
  const seaU = {
    uSD: { value: sdTex }, uTime: { value: 0 }, uBnd: { value: sdBnd },
    uShallow: { value: new THREE.Color('#9FE7DA') },   // shallow water keeps its own aqua
    uDeep: { value: new THREE.Color('#4E7E9E') },      // multiplied in out in the channel
  };
  const waterMat = new THREE.MeshStandardMaterial({ color: '#3FB2B6', transparent: true, opacity: 0.56, roughness: 0.28, metalness: 0.02, depthWrite: false });
  waterMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, seaU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>',
               '#include <worldpos_vertex>\n  vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP;
uniform sampler2D uSD; uniform float uTime; uniform vec4 uBnd; uniform vec3 uShallow; uniform vec3 uDeep;
float sdAt(vec2 p){ vec2 uv = vec2((p.x-uBnd.x)*uBnd.z, (p.y-uBnd.y)*uBnd.w);
  if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) return -13.0;
  return (texture2D(uSD, uv).r*255.0-128.0)/8.0; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float sd = sdAt(vWP.xz);
  float d  = max(0.0, -sd);                       // metres of water, roughly
  // three bands: pale aqua over sand, true colour on the reef flat, darker and
  // bluer out in the channel. the shoreline surf is the existing foam mesh's job,
  // so nothing is added here and nothing double-draws.
  vec3 tint = mix(uShallow, vec3(1.0), smoothstep(0.4, 5.0, d));
  tint = mix(tint, uDeep, smoothstep(5.5, 17.0, d));
  diffuseColor.rgb *= tint;
  diffuseColor.a   *= mix(0.34, 1.0, smoothstep(0.12, 5.0, d));
  float deep = smoothstep(0.4, 8.0, d);
  // two crossing ripple trains, stronger offshore where the sheet is opaque
  float w = sin(vWP.x*1.7 + uTime*0.75) * sin(vWP.z*1.45 - uTime*0.55)
          + 0.5*sin(vWP.x*3.3 - vWP.z*2.6 + uTime*1.15);
  diffuseColor.rgb *= 1.0 + w * 0.05 * (0.25 + deep);
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
{
  float g = sin(vWP.x*2.1 + uTime*0.9) * sin(vWP.z*1.9 - uTime*0.7);
  roughnessFactor = clamp(roughnessFactor + g*0.10, 0.04, 1.0);   // glints that drift
}`);
    waterMat.userData.sh = sh;
  };
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
  const PLANE_LEN = 2.25;                 // world units nose-to-tail at scale 1
  let planeK = 0;
  function updateZoomScale() {
    const dist = camera.position.distanceTo(controls.target);
    // Aircraft size. Measured at the default overview: 1440x900 gives 9.38 px per
    // world unit and 390x844 gives 4.33, so a plane about 14-16 units long lands
    // inside both acceptance windows (desktop 90-140 px, phone 55-90 px).
    // Compensation is deliberately gentle (dist^0.55) and clamped at both ends,
    // so zooming never makes it pop or swallow the island.
    const want = Math.max(1.1, Math.min(7.0, 5.0 * Math.pow(dist / 179, 0.55)));
    if (Math.abs(want - planeK) / Math.max(planeK, 1e-3) > 0.02) { planeK = want; props.setPlaneScale(want); }
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
  const numKeys = ['seaOp', 'hemi', 'sunI', 'shadow', 'win', 'bulb', 'stars', 'floor', 'glow', 'nav'];
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
    const nm = props.nightMats;
    if (nm.nav) { nm.nav.emissiveIntensity = cur.nav * 1.5; nm.navR.emissiveIntensity = cur.nav * 1.5; nm.navG.emissiveIntensity = cur.nav * 1.5; }
    if (nm.planeBody) nm.planeBody.emissiveIntensity = cur.nav * 0.22;
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
  const mk = GEO.markers.map(m => ({ ...m, prio: 0, el: markers.find(e => e.dataset.marker === m.id),
    v: new THREE.Vector3(m.x, Math.max(0.3, field.h(m.x, m.z)) + 1.0, m.z) }));
  for (const L of (props.landmarks || [])) {
    const el = (opts.landmarks || []).find(e => e.dataset.landmark === L.id);
    if (el) mk.push({ id: L.id, prio: 1, el, v: new THREE.Vector3(L.x, L.y, L.z) });
  }
  const tmp = new THREE.Vector3();
  function placeMarkers() {
    const vis = [], top = safeTop();
    for (const m of mk) {
      if (!m.el) continue;
      tmp.copy(m.v).project(camera);
      m.sx = (tmp.x * 0.5 + 0.5) * W; m.sy = (-tmp.y * 0.5 + 0.5) * H;
      m.off = tmp.z > 1 || m.sx < -80 || m.sx > W + 80 || m.sy < -40 || m.sy > H + 60;
      m.sy0 = m.sy;
      if (!m.w) { const p = m.el.firstElementChild; m.w = p ? p.offsetWidth : 110; m.hh = p ? p.offsetHeight : 40; }
      if (!m.off) vis.push(m);
    }
    // keep labels from covering each other: lift the one further north
    vis.sort((a, b) => (a.prio - b.prio) || (b.sy - a.sy));
    // sx/sy are the label's top-left corner, so this is a plain rectangle test:
    // only labels that really overlap push each other, and only far enough to clear.
    const G = 4;
    for (let i = 0; i < vis.length; i++) for (let j = 0; j < i; j++) {
      const a = vis[i], b = vis[j];
      if (a.sx > b.sx + b.w + G || b.sx > a.sx + a.w + G) continue;
      if (a.sy > b.sy + b.hh + G || b.sy > a.sy + a.hh + G) continue;
      a.sy = b.sy - a.hh - G;
    }
    // A label dragged too far has stopped pointing at its own model. Date markers
    // win the space; a landmark label that cannot sit near its landmark hides
    // instead of drifting across the map.
    for (const m of vis) {
      const lift = m.sy0 - m.sy;
      if (m.prio > 0 ? lift > 64 : lift > 150) { m.off = true; m.sy = m.sy0; continue; }
      // a landmark label near the edge is pulled back into view rather than clipped
      if (m.prio > 0) m.sx = Math.max(6, Math.min(m.sx, W - m.w - 6));
    }
    for (const m of mk) {
      if (!m.el) continue;
      if (!m.off && m.sy - m.hh - 6 < top) m.off = true;
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
      seaU.uTime.value = simT;
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

  const _bb = new THREE.Box3(), _v = new THREE.Vector3();
  function planeScreenPx() {
    if (!props.plane) return 0;
    props.plane.updateMatrixWorld();
    _bb.setFromObject(props.plane);
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    for (let i = 0; i < 8; i++) {
      _v.set(i & 1 ? _bb.max.x : _bb.min.x, i & 2 ? _bb.max.y : _bb.min.y, i & 4 ? _bb.max.z : _bb.min.z).project(camera);
      const x = (_v.x * 0.5 + 0.5) * W, y = (-_v.y * 0.5 + 0.5) * H;
      minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y);
    }
    return Math.round(Math.max(maxx - minx, maxy - miny));
  }

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
        phase: phaseKey, inset: { ...inset }, planeScale: +planeK.toFixed(3), planePx: planeScreenPx(), simT: +simT.toFixed(3),
      landmarks: (props.landmarks || []).map(l => l.id), dolphins: life.counts().dolphins,
      };
    },
    _debug: { scene, camera, controls, field, life, props, renderer, GEO },
  };
  onReady && onReady(api);
  return api;
}
