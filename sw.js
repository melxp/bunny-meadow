// Bunny Meadow service worker: makes the app installable and usable offline.
// App files are served cache-first and refreshed in the background.
// Supabase requests always go to the network (the app keeps its own offline copy of your data).
const VERSION = 'bm-v1';
const SHELL = [
  './', 'index.html', 'config.js', 'manifest.webmanifest', 'css/styles.css',
  'js/app.js', 'js/util.js', 'js/store.js', 'js/sync.js', 'js/timer.js', 'js/timer-engine.js', 'js/stats.js',
  'js/scene.js', 'js/art.js', 'js/audio.js', 'js/messages.js', 'js/ui.js',
  'js/views/home.js', 'js/views/tasks.js', 'js/views/stats.js', 'js/views/calendar.js', 'js/views/settings.js',
  'js/views/auth.js', 'js/views/task-ui.js', 'js/views/day-detail.js', 'js/views/charts.js', 'js/views/goal.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !fonts) return; // e.g. Supabase – always live
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: sameOrigin });
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        e.waitUntil(network);
        return cached;
      }
      const res = await network;
      if (res) return res;
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      return Response.error();
    })
  );
});

// Tapping a notification brings the app to the front
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow('./#home');
    })
  );
});
