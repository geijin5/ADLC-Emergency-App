import React, { useState, useEffect, useRef } from 'react';
import { getVapidPublicKey, subscribeToPush, unsubscribeFromPush } from '../../api/api';
import { isAppInstalled } from '../../utils/pushNotifications';

const PushNotification = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hasAutoSubscribed = useRef(false);

  useEffect(() => {
    checkSupportAndSubscription();
  }, []);

  const checkSupportAndSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setIsSupported(false);
      setIsLoading(false);
      return;
    }

    setIsSupported(true);

    try {
      // Check if VAPID keys are available first
      try {
        const vapidResponse = await getVapidPublicKey();
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
      let registration = await navigator.serviceWorker.getRegistration();
      
      if (!registration) {
        // No registration exists, but we don't need to register it yet
        // Registration will happen when user clicks subscribe
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
      const response = await getVapidPublicKey();
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
        registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/'
        });
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
      
      const serverResponse = await subscribeToPush(subscriptionData);
      
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
    // VAPID keys are base64url encoded, so we need to convert them properly
    // Remove any whitespace
    base64String = base64String.trim();
    
    // Add padding if needed (base64url doesn't use padding, but atob needs it)
    let base64 = base64String.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    base64 = base64 + padding;

    try {
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);

      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      
      // Verify the key length (VAPID public key should be 65 bytes for uncompressed EC key)
      if (outputArray.length !== 65) {
        console.warn(`VAPID key length is ${outputArray.length}, expected 65 bytes`);
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

      // Get VAPID public key first
      console.log('Getting VAPID public key...');
      let response;
      try {
        response = await getVapidPublicKey();
        console.log('VAPID key response:', response);
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
      console.log('VAPID public key received:', vapidPublicKey.substring(0, 20) + '...');

      // Register service worker
      console.log('Registering service worker...');
      let registration;
      try {
        // Check if service worker is already registered
        const existingRegistrations = await navigator.serviceWorker.getRegistrations();
        if (existingRegistrations.length > 0) {
          console.log('Found existing service worker registration');
          registration = existingRegistrations[0];
        } else {
          console.log('Registering new service worker...');
          registration = await navigator.serviceWorker.register('/service-worker.js', {
            scope: '/'
          });
          console.log('Service Worker registered:', registration);
        }
        
        // Wait for service worker to be ready with timeout
        console.log('Waiting for service worker to be ready...');
        await Promise.race([
          registration.ready,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Service worker timeout')), 10000)
          )
        ]);
        console.log('✅ Service Worker ready');
      } catch (swError) {
        console.error('❌ Service worker registration error:', swError);
        if (swError.message === 'Service worker timeout') {
          alert('Service worker took too long to initialize. Please refresh the page and try again.');
        } else {
          alert(`Failed to register service worker: ${swError.message}\n\nPlease check browser console for details.`);
        }
        setIsLoading(false);
        return;
      }

      // Convert VAPID key
      console.log('Converting VAPID key...');
      console.log('VAPID key length:', vapidPublicKey.length);
      console.log('VAPID key preview:', vapidPublicKey.substring(0, 50) + '...');
      
      let applicationServerKey;
      try {
        applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        console.log('✅ VAPID key converted successfully, length:', applicationServerKey.length);
      } catch (keyError) {
        console.error('❌ VAPID key conversion error:', keyError);
        alert(`Invalid VAPID key format: ${keyError.message}\n\nPlease contact the administrator.`);
        setIsLoading(false);
        return;
      }

      // Subscribe to push notifications
      console.log('Subscribing to push notifications...');
      console.log('Service worker scope:', registration.scope);
      console.log('Push manager available:', !!registration.pushManager);
      
      let subscription;
      try {
        // Try to get existing subscription first
        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) {
          console.log('Found existing subscription, using it');
          subscription = existingSubscription;
        } else {
          console.log('No existing subscription, creating new one...');
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey
          });
          console.log('✅ Push subscription created successfully');
        }
        
        console.log('Subscription endpoint:', subscription.endpoint);
        console.log('Subscription keys present:', {
          p256dh: !!subscription.getKey('p256dh'),
          auth: !!subscription.getKey('auth')
        });
      } catch (subError) {
        console.error('❌ Push subscription error:', subError);
        console.error('Error details:', {
          name: subError.name,
          message: subError.message,
          stack: subError.stack
        });
        
        if (subError.name === 'NotAllowedError') {
          alert('Push notifications were blocked. Please allow notifications in your browser settings and try again.');
        } else if (subError.name === 'NotSupportedError') {
          alert('Push notifications are not supported in this browser.');
        } else if (subError.message && subError.message.includes('push service error')) {
          alert('Push service error. This may be due to:\n\n' +
                '1. Invalid VAPID keys\n' +
                '2. Browser push service unavailable\n' +
                '3. Network connectivity issues\n\n' +
                'Please try again later or contact support.');
        } else {
          alert(`Failed to subscribe: ${subError.message || subError.name || 'Unknown error'}\n\nPlease check the browser console for more details.`);
        }
        setIsLoading(false);
        return;
      }

      // Send subscription to server
      console.log('Sending subscription to server...');
      try {
        // Convert subscription to JSON-serializable format
        // The keys need to be base64url encoded (which btoa provides, but we need to handle padding)
        const p256dhKey = subscription.getKey('p256dh');
        const authKey = subscription.getKey('auth');
        
        // Convert ArrayBuffer to base64 string
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
        
        console.log('Subscription data to send:', { 
          endpoint: subscriptionData.endpoint.substring(0, 50) + '...',
          hasP256dh: !!subscriptionData.keys.p256dh,
          hasAuth: !!subscriptionData.keys.auth,
          p256dhLength: subscriptionData.keys.p256dh?.length,
          authLength: subscriptionData.keys.auth?.length
        });
        
        const response = await subscribeToPush(subscriptionData);
        console.log('✅ Subscription saved to server:', response.data);
        
        // Verify subscription was saved by checking the response
        if (response.data && response.data.success) {
          setIsSubscribed(true);
          alert('✅ Push notifications enabled! You will receive emergency alerts.');
        } else {
          throw new Error('Server did not confirm subscription was saved');
        }
      } catch (serverError) {
        console.error('❌ Server subscription error:', serverError);
        console.error('Error details:', {
          message: serverError.message,
          response: serverError.response?.data,
          status: serverError.response?.status
        });
        // Unsubscribe locally if server save failed
        try {
          await subscription.unsubscribe();
          console.log('Unsubscribed locally after server error');
        } catch (unsubError) {
          console.error('Failed to unsubscribe after server error:', unsubError);
        }
        const errorMessage = serverError.response?.data?.error || serverError.message || 'Unknown error';
        alert(`❌ Failed to save subscription: ${errorMessage}\n\nPlease try again.`);
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
        await unsubscribeFromPush(subscription.endpoint);
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
    return null; // Don't show anything if push notifications aren't supported
  }

  return (
    <div className="card" style={{ marginTop: '20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h3 style={{ margin: '0 0 5px 0', color: '#f9fafb' }}>🔔 Push Notifications</h3>
          <p style={{ margin: 0, color: '#d1d5db', fontSize: '14px' }}>
            Get instant emergency alerts delivered to your device
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
          {isLoading ? 'Loading...' : isSubscribed ? '🔕 Disable Notifications' : '🔔 Enable Notifications'}
        </button>
      </div>
    </div>
  );
};

export default PushNotification;

