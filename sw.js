/* Cebu × Bohol 2026 — Service Worker
   目的：一次開啟後，即使在船上、山路上沒有訊號，也看得到整份行程。
   方針：
   - 頁面本體（navigate）＝網路優先，離線時才用快取
   - 字型等靜態資源＝快取優先＋背景更新
   - 天氣 API 與匯率 API＝永不快取（寧可顯示「取不到」，也不給過期或猜測的數字）
   - Google 地圖等外部連結＝不攔截，交給瀏覽器 */
'use strict';
var VERSION = 'cebu-bohol-2026-v11-quality';
var CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './js/island.js',
  './js/field.js',
  './js/kit.js',
  './js/props.js',
  './js/life.js',
  './js/geo-data.js',
  './js/music.js',
  './audio/cebuano.mp3',
  './vendor/three.module.min.js',
  './vendor/addons/controls/OrbitControls.js',
  './vendor/addons/utils/BufferGeometryUtils.js'
];
var CACHE_HOSTS = [
  self.location.hostname,
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];
/* 這些一律放行、永不快取：必須是即時值 */
var NEVER_CACHE = [
  'api.open-meteo.com',
  'open.er-api.com',
  'latest.currency-api.pages.dev',
  'cdn.jsdelivr.net'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION)
      .then(function (c) { return c.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  /* 天氣與匯率永遠走網路 */
  if (NEVER_CACHE.indexOf(url.hostname) !== -1) return;

  /* 頁面本體：網路優先 → 離線時回快取 */
  if (req.mode === 'navigate') {
    if (url.origin !== self.location.origin) return;
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      })
    );
    return;
  }

  /* 其他網域（Google 地圖等）不攔截 */
  if (CACHE_HOSTS.indexOf(url.hostname) === -1) return;

  /* 靜態資源：快取優先＋背景更新 */
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
