const CACHE='keyback-local-v4';
const ASSETS=['./','./index.html','./style.css','./app.js','./manifest.json','./wordlists/nomi_it.txt','./wordlists/cognomi_it.txt','./wordlists/comuni_it.txt','./wordlists/animali_it.txt','./wordlists/parole_it.txt','./wordlists/mesi_it.txt'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
