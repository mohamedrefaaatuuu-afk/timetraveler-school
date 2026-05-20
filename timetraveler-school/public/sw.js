// Self-destructing service worker - clears all caches and unregisters
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    ).then(() => {
      return self.clients.matchAll({ type: 'window' });
    }).then((clients) => {
      return self.registration.unregister().then(() => {
        clients.forEach((client) => client.navigate(client.url));
      });
    })
  );
});
