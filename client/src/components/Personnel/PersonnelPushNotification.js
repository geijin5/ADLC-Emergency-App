import React, { useState, useEffect, useRef } from 'react';
import { getPersonnelVapidPublicKey, subscribePersonnelToPush, unsubscribePersonnelFromPush } from '../../api/api';
import { isAppInstalled } from '../../utils/pushNotifications';

const PersonnelPushNotification = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hasAutoSubscribed = useRef(false);

  useEffect(() => {
    checkSupportAndSubscription();
  }, []);

  const checkSupportAndSubscription = async () => {
    // Check basic support with detailed logging
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasPushManager = 'PushManager' in window;
    
    console.log('Personnel push notification support check:', {
      hasServiceWorker,
      hasPushManager,
      userAgent: navigator.userAgent,
      protocol: window.location?.protocol,
      isCapacitor: !!(window.Capacitor || window.CapacitorWeb)
    });
    
    if (!hasServiceWorker || !hasPushManager) {
      console.warn('Push notifications not supported:', {
        serviceWorker: hasServiceWorker,
        pushManager: hasPushManager
      });
      setIsSupported(false);
      setIsLoading(false);
      return;
    }

    setIsSupported(true);

    try {
      // Check if VAPID keys are available first
      try {
        const vapidResponse = await getPersonnelVapidPublicKey();
        if (!vapidResponse.data || !vapidResponse.data.publicKey) {
          console.warn('VAPID keys not configured on server');
          setIsLoading(false);
          return;
        }
      } catch (vapidError) {
        console.error('VAPID keys not available:', vapidError);
        if (vapidError.response?.status === 503) {
          console.warn('Push notifications are not configured on the server');
        }
        setIsLoading(false);
        return;
      }

      // Check for existing service worker registration
      let registration;
      try {
        registration = await navigator.serviceWorker.getRegistration();
        console.log('Service worker registration check:', {
          found: !!registration,
          scope: registration?.scope,
          active: !!registration?.active,
          installing: !!registration?.installing,
          waiting: !!registration?.waiting
        });
      } catch (regError) {
        console.error('Error checking service worker registration:', regError);
        registration = null;
      }
      
      if (!registration) {
        console.log('No service worker registration found, will register on subscribe');
        setIsSubscribed(false);
        setIsLoading(false);
        return;
      }

      // Wait for service worker to be ready with a timeout
      try {
        await Promise.race([
          registration.ready,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Service worker timeout')), 5000)
          )
        ]);
      } catch (timeoutError) {
        console.warn('Service worker not ready yet:', timeoutError.message);
        setIsSubscribed(false);
        setIsLoading(false);
        return;
      }

      // Check subscription status
      const subscription = await registration.pushManager.getSubscription();
      const alreadySubscribed = !!subscription;
      setIsSubscribed(alreadySubscribed);
      
      // If app is installed and not subscribed, try to auto-subscribe
      if (!alreadySubscribed && isAppInstalled() && !hasAutoSubscribed.current) {
        hasAutoSubscribed.current = true;
        console.log('App is installed, attempting auto-subscribe...');
        // Auto-subscribe in the background (don't wait for it)
        autoSubscribe().catch(err => {
          console.log('Auto-subscribe failed (this is OK if permission not granted):', err);
        });
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-subscribe function (called when app is installed)
  const autoSubscribe = async () => {
    try {
      // Get VAPID public key
      const response = await getPersonnelVapidPublicKey();
      if (!response.data || !response.data.publicKey) {
        return;
      }

      const vapidPublicKey = response.data.publicKey;

      // Register service worker
      let registration;
      const existingRegistrations = await navigator.serviceWorker.getRegistrations();
      if (existingRegistrations.length > 0) {
        registration = existingRegistrations[0];
      } else {
        // Try different paths for service worker (for Capacitor compatibility)
        const swPaths = ['/service-worker.js', './service-worker.js', 'service-worker.js'];
        let registered = false;
        
        for (const swPath of swPaths) {
          try {
            registration = await navigator.serviceWorker.register(swPath, {
              scope: '/'
            });
            console.log('✅ Service Worker registered at:', swPath);
            registered = true;
            break;
          } catch (pathError) {
            console.warn(`Failed to register at ${swPath}:`, pathError.message);
            // Continue to next path
          }
        }
        
        if (!registered) {
          throw new Error('Failed to register service worker at any path');
        }
      }
      
      await Promise.race([
        registration.ready,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Service worker timeout')), 10000)
        )
      ]);

      // Convert VAPID key
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // Subscribe to push notifications
      let subscription;
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        subscription = existingSubscription;
      } else {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey
        });
      }

      // Send subscription to server
      const p256dhKey = subscription.getKey('p256dh');
      const authKey = subscription.getKey('auth');
      
      const p256dhBase64 = btoa(String.fromCharCode(...new Uint8Array(p256dhKey)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      const authBase64 = btoa(String.fromCharCode(...new Uint8Array(authKey)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      const subscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: p256dhBase64,
          auth: authBase64
        }
      };
      
      const serverResponse = await subscribePersonnelToPush(subscriptionData);
      
      if (serverResponse.data && serverResponse.data.success) {
        setIsSubscribed(true);
        console.log('✅ Auto-subscribed to push notifications');
      }
    } catch (error) {
      // Silently fail - user can manually subscribe if needed
      console.log('Auto-subscribe failed (this is OK):', error);
    }
  };

  const urlBase64ToUint8Array = (base64String) => {
    base64String = base64String.trim();
    let base64 = base64String.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    base64 = base64 + padding;

    try {
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);

      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      
      return outputArray;
    } catch (error) {
      console.error('Error converting VAPID key:', error);
      throw new Error('Invalid VAPID key format: ' + error.message);
    }
  };

  const subscribe = async () => {
    if (!isSupported) {
      alert('Push notifications are not supported in this browser.');
      return;
    }

    try {
      setIsLoading(true);

      // Get VAPID public key
      let response;
      try {
        response = await getPersonnelVapidPublicKey();
      } catch (vapidError) {
        console.error('Failed to get VAPID key:', vapidError);
        if (vapidError.response?.status === 503) {
          alert('Push notifications are not configured on the server. Please contact the administrator.');
        } else {
          alert('Failed to connect to server. Please check your connection and try again.');
        }
        setIsLoading(false);
        return;
      }

      if (!response.data || !response.data.publicKey) {
        alert('Push notifications are not configured on the server.');
        setIsLoading(false);
        return;
      }

      const vapidPublicKey = response.data.publicKey;

      // Register service worker
      let registration;
      try {
        const existingRegistrations = await navigator.serviceWorker.getRegistrations();
        if (existingRegistrations.length > 0) {
          registration = existingRegistrations[0];
        } else {
          // Try different paths for service worker (for Capacitor compatibility)
          const swPaths = ['/service-worker.js', './service-worker.js', 'service-worker.js'];
          let registered = false;
          
          for (const swPath of swPaths) {
            try {
              console.log(`Trying to register service worker at: ${swPath}`);
              registration = await navigator.serviceWorker.register(swPath, {
                scope: '/'
              });
              console.log('✅ Service Worker registered at:', swPath, registration);
              registered = true;
              break; // Success, exit loop
            } catch (pathError) {
              console.warn(`Failed to register at ${swPath}:`, pathError.message);
              // Continue to next path
            }
          }
          
          if (!registered) {
            throw new Error('Failed to register service worker at any path');
          }
        }
        
        await Promise.race([
          registration.ready,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Service worker timeout')), 10000)
          )
        ]);
      } catch (swError) {
        console.error('Service worker registration error:', swError);
        if (swError.message === 'Service worker timeout') {
          alert('Service worker took too long to initialize. Please refresh the page and try again.');
        } else {
          alert(`Failed to register service worker: ${swError.message}`);
        }
        setIsLoading(false);
        return;
      }

      // Convert VAPID key
      let applicationServerKey;
      try {
        applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      } catch (keyError) {
        console.error('VAPID key conversion error:', keyError);
        alert(`Invalid VAPID key format: ${keyError.message}`);
        setIsLoading(false);
        return;
      }

      // Subscribe to push notifications
      let subscription;
      try {
        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) {
          subscription = existingSubscription;
        } else {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey
          });
        }
      } catch (subError) {
        console.error('Push subscription error:', subError);
        
        if (subError.name === 'NotAllowedError') {
          alert('Push notifications were blocked. Please allow notifications in your browser settings and try again.');
        } else if (subError.name === 'NotSupportedError') {
          alert('Push notifications are not supported in this browser.');
        } else {
          alert(`Failed to subscribe: ${subError.message || subError.name || 'Unknown error'}`);
        }
        setIsLoading(false);
        return;
      }

      // Send subscription to server
      try {
        const p256dhKey = subscription.getKey('p256dh');
        const authKey = subscription.getKey('auth');
        
        const p256dhBase64 = btoa(String.fromCharCode(...new Uint8Array(p256dhKey)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        
        const authBase64 = btoa(String.fromCharCode(...new Uint8Array(authKey)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        
        const subscriptionData = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: p256dhBase64,
            auth: authBase64
          }
        };
        
        const serverResponse = await subscribePersonnelToPush(subscriptionData);
        
        if (serverResponse.data && serverResponse.data.success) {
          setIsSubscribed(true);
          alert('✅ Push notifications enabled! You will receive Mass Callout alerts.');
        } else {
          throw new Error('Server did not confirm subscription was saved');
        }
      } catch (serverError) {
        console.error('Server subscription error:', serverError);
        try {
          await subscription.unsubscribe();
        } catch (unsubError) {
          console.error('Failed to unsubscribe after server error:', unsubError);
        }
        const errorMessage = serverError.response?.data?.error || serverError.message || 'Unknown error';
        alert(`❌ Failed to save subscription: ${errorMessage}`);
        setIsLoading(false);
        return;
      }
    } catch (error) {
      console.error('Unexpected error subscribing to push notifications:', error);
      alert(`Failed to enable push notifications: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    try {
      setIsLoading(true);

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await unsubscribePersonnelFromPush(subscription.endpoint);
      }

      setIsSubscribed(false);
      alert('Push notifications disabled.');
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      alert('Failed to disable push notifications. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className="card" style={{ marginBottom: '20px', padding: '15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h3 style={{ margin: '0 0 5px 0', color: '#f9fafb' }}>🔔 Callout Notifications</h3>
          <p style={{ margin: 0, color: '#d1d5db', fontSize: '14px' }}>
            Get instant push notifications for Mass Callouts
          </p>
        </div>
        <button
          onClick={isSubscribed ? unsubscribe : subscribe}
          disabled={isLoading}
          className={isSubscribed ? 'btn btn-secondary' : 'btn btn-success'}
          style={{
            whiteSpace: 'nowrap',
            padding: '10px 20px'
          }}
        >
          {isLoading ? 'Loading...' : isSubscribed ? '🔕 Disable' : '🔔 Enable'}
        </button>
      </div>
    </div>
  );
};

export default PersonnelPushNotification;

