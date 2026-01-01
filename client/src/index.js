import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Determine the correct path for service worker
    // In Capacitor, we might need to use a different path
    const swPath = '/service-worker.js';
    
    navigator.serviceWorker.register(swPath, { scope: '/' })
      .then((registration) => {
        console.log('✅ Service Worker registered successfully:', {
          scope: registration.scope,
          active: !!registration.active,
          installing: !!registration.installing,
          waiting: !!registration.waiting
        });
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          console.log('Service Worker update found');
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New service worker installed, reload to activate');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
          path: swPath,
          isCapacitor: !!(window.Capacitor || window.CapacitorWeb),
          protocol: window.location?.protocol
        });
      });
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

