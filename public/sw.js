const CACHE_NAME = 'ring-shell-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install Event: Caches the PWA static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching PWA shell assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event: Deletes old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== 'ring-api-cache') {
            console.log('[Service Worker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Handles offline serving
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // API Requests: Network-first, with local API cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open('ring-api-cache').then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          console.log('[Service Worker] Network failed for API request, serving cached copy');
          return caches.match(event.request);
        })
    );
    return;
  }

  // Static Assets: Cache-first, falling back to network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // Cache same-origin assets on the fly
        if (response.status === 200 && url.origin === self.location.origin) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      });
    })
  );
});

// ------------------------------------------------
// Push Notification Handler (M3: Real-Time Alerts)
// ------------------------------------------------
self.addEventListener('push', (event) => {
  let data = { title: '⚡ Ring Alert', body: 'Something significant just happened.', url: '/' };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.warn('[Service Worker] Could not parse push data:', e);
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'ring-alert',
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || '/',
      sourceName: data.sourceName || 'Ring'
    },
    actions: [
      { action: 'open', title: 'Read Now' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click — open Ring to the relevant item
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';
  // Encode the source URL as a query param so the app can highlight it
  const ringUrl = `/?alert=${encodeURIComponent(targetUrl)}`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If Ring is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.postMessage({ type: 'RING_ALERT_NAVIGATE', url: targetUrl });
          return client.focus();
        }
      }
      // Otherwise open a new window
      return clients.openWindow(ringUrl);
    })
  );
});
