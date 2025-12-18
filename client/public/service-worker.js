// Service Worker for Push Notifications
console.log('Service Worker: Script loaded');

self.addEventListener('install', function(event) {
  console.log('Service Worker: Installing...');
  self.skipWaiting(); // Activate immediately
});

self.addEventListener('activate', function(event) {
  console.log('Service Worker: Activating...');
  event.waitUntil(self.clients.claim()); // Take control of all pages
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

  event.waitUntil(
    clients.openWindow('/alerts')
  );
});

