// Minimal hand-rolled service worker (no vite-plugin-pwa in this sandbox —
// no npm registry access, see the project report). Caches the app shell so
// the icon/name install cleanly and a repeat visit paints instantly; it
// deliberately does NOT cache /api or /ws — those always need to be live.
// v2 adds push + notificationclick — bumped so the new worker actually
// takes over instead of an already-installed v1 worker sitting there with
// no push handler.
const CACHE_NAME = 'posh-list-shell-v2';
const SHELL_ASSETS = ['/', '/index.html', '/manifest.json', '/assets/bundle.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
  );
});

// The badge (RoomContext.jsx, Home.jsx) only updates while the app is open
// — this is what keeps it current while it's closed. iOS revokes a
// subscription from any app that receives a push without showing a
// notification for it, so every push here calls showNotification, even
// though the badge update is really the point for someone who already has
// the list open elsewhere. `tag: slug` collapses repeated adds to the same
// list into one notification instead of stacking a dozen — the trade-off
// is that only the most recent item's text survives the collapse.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Not JSON — still have to show *something*, see above.
  }
  const { slug, title, body, unticked } = data;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title || 'Posh List', {
        body: body || 'The list was updated.',
        tag: slug || 'posh-list',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url: slug ? `/r/${slug}` : '/' },
      }),
      unticked != null && 'setAppBadge' in self.navigator
        ? self.navigator.setAppBadge(unticked).catch(() => {})
        : Promise.resolve(),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find((c) => new URL(c.url).pathname === url);
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
