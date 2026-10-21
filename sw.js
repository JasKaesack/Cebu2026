/* Cebu × Bohol 2026 Service Worker
   目的：開過一次後，在墨寶／薄荷島沒訊號時也能離線看行程。
   - 頁面本體：網路優先，離線時才用快取
   - 靜態資源（字型・CSS・圖示）：快取優先＋背景更新
   - 天氣 API：永遠即時，不快取（避免顯示過期資料） */
'use strict';
var VERSION = 'cebu-bohol-2026-v1';
var CORE = ['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
var HOSTS = [self.location.hostname,'cdn.tailwindcss.com','cdnjs.cloudflare.com','fonts.googleapis.com','fonts.gstatic.com'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){ return c.addAll(CORE); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){ return k !== VERSION; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var url = new URL(req.url);

  /* 天氣永遠走網路 */
  if(url.hostname === 'api.open-meteo.com') return;

  /* 頁面：網路優先 */
  if(req.mode === 'navigate'){
    if(url.origin !== self.location.origin) return;
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(VERSION).then(function(c){ c.put('./index.html', copy); });
        return res;
      }).catch(function(){ return caches.match('./index.html'); })
    );
    return;
  }

  if(HOSTS.indexOf(url.hostname) === -1) return;

  /* 靜態資源：快取優先＋背景更新 */
  e.respondWith(
    caches.match(req).then(function(hit){
      var net = fetch(req).then(function(res){
        if(res && (res.status === 200 || res.type === 'opaque')){
          var copy = res.clone();
          caches.open(VERSION).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){ return hit; });
      return hit || net;
    })
  );
});
