const CACHE='keyback-local-v8';
const ASSETS=['./','./index.html','./style.css','./app.js','./manifest.json','./wordlists/nomi_it.txt','./wordlists/cognomi_it.txt','./wordlists/comuni_it.txt','./wordlists/animali_it.txt','./wordlists/nomi_animali_it.txt','./wordlists/mesi_it.txt','./wordlists/parole_it.txt'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim();});
self.addEventListener('fetch',e=>{e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))});
