const CACHE='aeroping-shell-v3';
const FILES=['./','./index.html','./styles.css?v=2','./app.js?v=2','./core.js','./cloud-v2.js','./shared-ui.js?v=3','./site-config.js','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('aeroping-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;const url=new URL(e.request.url);if(!FILES.some(f=>new URL(f,self.registration.scope).pathname===url.pathname))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const clone=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,clone)));}return r;}).catch(()=>caches.match(e.request)));});
