const CACHE_VERSION = 'v1';
const STATIC_CACHE = `noxis-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `noxis-dynamic-${CACHE_VERSION}`;
const API_CACHE = `noxis-api-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

const API_CACHE_TTL = 60 * 60 * 1000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS).catch((error) => {
          console.warn('Failed to cache some static assets:', error);
          return Promise.resolve();
        });
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name.startsWith('noxis-') && 
                   name !== STATIC_CACHE && 
                   name !== DYNAMIC_CACHE && 
                   name !== API_CACHE;
          })
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.hostname === 'api.themoviedb.org') {
    event.respondWith(
      caches.open(API_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            const dateHeader = cachedResponse.headers.get('sw-cached-at');
            if (dateHeader) {
              const cachedAt = parseInt(dateHeader, 10);
              if (Date.now() - cachedAt < API_CACHE_TTL) {
                return cachedResponse;
              }
            }
          }

          return fetch(request).then((response) => {
            if (response.ok) {
              const responseClone = response.clone();
              const headers = new Headers(responseClone.headers);
              headers.append('sw-cached-at', Date.now().toString());
              
              responseClone.blob().then((body) => {
                const cachedResponse = new Response(body, {
                  status: responseClone.status,
                  statusText: responseClone.statusText,
                  headers: headers
                });
                cache.put(request, cachedResponse);
              });
            }
            return response;
          }).catch(() => cachedResponse);
        });
      })
    );
    return;
  }

  if (url.hostname === 'image.tmdb.org') {
    event.respondWith(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          return fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => {
            return new Response('', { status: 404 });
          });
        });
      })
    );
    return;
  }

  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok && request.method === 'GET') {
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, response.clone());
            });
          }
          return response;
        });

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  event.respondWith(fetch(request));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
