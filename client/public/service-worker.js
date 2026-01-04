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
  const url = new URL(event.request.url);
  
  // Skip caching for API requests
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  // Skip caching for external requests (like OSRM routing service)
  // Only handle requests from the same origin
  if (url.origin !== self.location.origin) {
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

// Function to play alarm sound using Web Audio API
function playAlarmSound() {
  try {
    // Create audio context
    const audioContext = new (self.AudioContext || self.webkitAudioContext)();
    
    // Create oscillator for alarm tone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configure alarm sound (alternating high/low tones)
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    
    // Gain envelope for pulsing effect
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    
    // Create pulsing alarm pattern (3 beeps)
    const beepDuration = 0.3;
    const pauseDuration = 0.1;
    const totalDuration = (beepDuration + pauseDuration) * 3;
    
    // First beep
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0, audioContext.currentTime + beepDuration);
    
    // Second beep (higher pitch)
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + beepDuration + pauseDuration);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + beepDuration + pauseDuration);
    gainNode.gain.setValueAtTime(0, audioContext.currentTime + (beepDuration + pauseDuration) * 2);
    
    // Third beep (even higher pitch)
    oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + (beepDuration + pauseDuration) * 2);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + (beepDuration + pauseDuration) * 2);
    gainNode.gain.setValueAtTime(0, audioContext.currentTime + totalDuration);
    
    // Start and stop oscillator
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + totalDuration);
    
    // Clean up after sound completes
    setTimeout(() => {
      audioContext.close();
    }, totalDuration * 1000 + 100);
  } catch (error) {
    console.error('Error playing alarm sound:', error);
  }
}

self.addEventListener('push', function(event) {
  console.log('Service Worker: Push event received');
  let notificationData = {
    title: 'ADLC Emergency Alert',
    body: 'You have a new emergency alert',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: 'emergency-alert',
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {}
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData.title = data.title || notificationData.title;
      notificationData.body = data.message || notificationData.body;
      notificationData.icon = data.icon || '/logo.png';
      notificationData.badge = data.badge || '/logo.png';
      notificationData.data = data;
      
      // Check if this is a callout notification
      if (data.type === 'callout' || data.tag === 'mass-callout') {
        notificationData.tag = 'mass-callout';
        notificationData.requireInteraction = true;
        notificationData.vibrate = [200, 100, 200, 100, 200, 100, 200, 100, 200];
        // Play alarm sound for callout
        playAlarmSound();
      } else if (data.type === 'chat' || data.tag === 'chat-message') {
        // Chat message notification - less intrusive
        notificationData.tag = 'chat-message';
        notificationData.requireInteraction = false;
        notificationData.vibrate = [200, 100, 200];
      } else {
        // Public alert notification
        notificationData.tag = 'public-alert';
        // Make danger alerts more noticeable
        if (data.severity === 'danger') {
          notificationData.requireInteraction = true;
          notificationData.vibrate = [300, 100, 300, 100, 300];
        } else {
          notificationData.requireInteraction = false;
          notificationData.vibrate = [200, 100, 200];
        }
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
  
  // Check notification type and route accordingly
  if (event.notification.data) {
    const data = event.notification.data;
    if (data.type === 'callout' || data.type === 'chat') {
      // Personnel notifications
      url = '/personnel/dashboard';
    } else if (data.url) {
      // Use explicit URL if provided
      url = data.url;
    } else {
      // Public alert notifications default to alerts page
      url = '/alerts';
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Check if there's already a window open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        // Try to find a matching client or any open client
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // If no matching window is open, open/focus a new one
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

