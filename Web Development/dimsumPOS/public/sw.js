/* Service worker POS Dimsum — cache shell aplikasi (Req 10.4). */

const CACHE = 'pos-dimsum-v1';
const SHELL = ['/', '/login', '/kasir', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((kunci) =>
      Promise.all(kunci.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Data transaksi tidak pernah dilayani dari cache — angka harus selalu segar.
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request)
      .then((respons) => {
        const salinan = respons.clone();
        caches.open(CACHE).then((cache) => cache.put(request, salinan)).catch(() => undefined);
        return respons;
      })
      .catch(() => caches.match(request).then((tersimpan) => tersimpan ?? caches.match('/kasir'))),
  );
});
