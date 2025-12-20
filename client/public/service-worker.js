// Service Worker for Push Notifications and PWA
const CACHE_NAME = 'adlc-emergency-v1';
const urlsToCache = [
  '/',
  '/logo.png',
  '/manifest.json',
  '/service-worker.js'
];

console.log('Service Worker: Script loaded');

self.addEventListener('install', function(event) {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Service Worker: Caching essential files');
        // Only cache essential files, let the app handle dynamic assets
        return cache.addAll(urlsToCache).catch(err => {
          console.log('Service Worker: Some files failed to cache', err);
          // Continue even if some files fail
          return Promise.resolve();
        });
      })
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

self.addEventListener('activate', function(event) {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all pages
  );
});

// Fetch event for offline support
self.addEventListener('fetch', function(event) {
  // Skip caching for API requests
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Return cached version if available
        if (response) {
          return response;
        }
        // Otherwise fetch from network
        return fetch(event.request).then(function(response) {
          // Don't cache if not a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          // Clone the response
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseToCache);
          });
          return response;
        }).catch(function() {
          // If fetch fails and it's a navigation request, return the index page
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});

self.addEventListener('push', function(event) {
  console.log('Service Worker: Push event received');
  let notificationData = {
    title: 'ADLC Emergency Alert',
    body: 'You have a new emergency alert',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'emergency-alert',
    requireInteraction: true,
    data: {}
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData.title = data.title || notificationData.title;
      notificationData.body = data.message || notificationData.body;
      notificationData.data = data;
      
      // Set badge color based on severity
      if (data.severity === 'danger') {
        notificationData.badge = '/favicon.ico';
        notificationData.icon = '/favicon.ico';
      }
    } catch (e) {
      console.error('Error parsing push notification data:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  let url = '/alerts';
  
  // Check if this is a callout notification
  if (event.notification.data && event.notification.data.type === 'callout') {
    url = '/personnel/dashboard';
  } else if (event.notification.data && event.notification.data.url) {
    url = event.notification.data.url;
  }

  event.waitUntil(
    clients.openWindow(url)
  );
});

