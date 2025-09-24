// Service Worker for Trading Dashboard PWA
const CACHE_NAME = 'trading-dashboard-v1.2';
const STATIC_CACHE_NAME = 'trading-dashboard-static-v1.2';
const DATA_CACHE_NAME = 'trading-dashboard-data-v1.2';

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/index.html',
  '/assets/styles.css',
  '/assets/dashboard.js',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.0/firebase-database-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore-compat.js'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .catch((error) => {
        console.error('Service Worker: Cache failed', error);
      })
  );

  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
  );

  // Take control immediately
  return self.clients.claim();
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Handle Firebase requests separately
  if (requestUrl.hostname.includes('firebase') || requestUrl.hostname.includes('googleapis')) {
    event.respondWith(handleFirebaseRequest(event.request));
    return;
  }

  // Handle static files
  if (event.request.destination === 'document' ||
      event.request.destination === 'script' ||
      event.request.destination === 'style' ||
      event.request.url.includes('chart.js')) {
    event.respondWith(handleStaticRequest(event.request));
    return;
  }

  // Default: try network first, then cache
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Handle static file requests (cache first, then network)
function handleStaticRequest(request) {
  return caches.open(STATIC_CACHE_NAME)
    .then((cache) => {
      return cache.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached version and update cache in background
            updateCacheInBackground(cache, request);
            return cachedResponse;
          }

          // Not in cache, fetch from network
          return fetch(request)
            .then((networkResponse) => {
              // Cache the response for future use
              if (networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch((error) => {
              console.error('Service Worker: Network request failed', error);
              // Return offline fallback if available
              return getOfflineFallback(request);
            });
        });
    });
}

// Handle Firebase requests (network first, then cache)
function handleFirebaseRequest(request) {
  return caches.open(DATA_CACHE_NAME)
    .then((cache) => {
      return fetch(request)
        .then((networkResponse) => {
          // Cache successful responses
          if (networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch((error) => {
          console.log('Service Worker: Network failed, trying cache for Firebase request');
          return cache.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                // Add a header to indicate this is cached data
                const response = cachedResponse.clone();
                return new Response(response.body, {
                  status: response.status,
                  statusText: response.statusText + ' (Cached)',
                  headers: response.headers
                });
              }
              throw error;
            });
        });
    });
}

// Update cache in background
function updateCacheInBackground(cache, request) {
  fetch(request)
    .then((response) => {
      if (response.status === 200) {
        cache.put(request, response.clone());
      }
    })
    .catch(() => {
      // Silently fail for background updates
    });
}

// Offline fallback
function getOfflineFallback(request) {
  if (request.destination === 'document') {
    return caches.match('/index.html');
  }

  // Return a simple offline response for other requests
  return new Response(JSON.stringify({
    error: 'Offline',
    message: 'No internet connection available',
    timestamp: new Date().toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200
  });
}

// Background sync for when connection is restored
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(
      // Trigger a data refresh when connection is restored
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'CONNECTION_RESTORED' });
        });
      })
    );
  }
});

// Push notification support (optional)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/assets/images/icon-192x192.png',
      badge: '/assets/images/icon-96x96.png',
      vibrate: [200, 100, 200],
      tag: 'trading-update',
      renotify: true,
      requireInteraction: false,
      actions: [
        {
          action: 'view',
          title: 'View Dashboard',
          icon: '/assets/images/icon-96x96.png'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Trading Update', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view' || !event.action) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        // Check if app is already open
        for (const client of clients) {
          if (client.url.includes(self.location.origin)) {
            return client.focus();
          }
        }
        // Open new window if app is not open
        return self.clients.openWindow('/');
      })
    );
  }
});