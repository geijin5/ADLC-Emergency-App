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
    // Check basic support with detailed logging
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasPushManager = 'PushManager' in window;
    
    console.log('Push notification support check:', {
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
        const vapidResponse = await getVapidPublicKey();
        if (!vapidResponse.data || !vapidResponse.data.publicKey) {
          console.warn('VAPID keys not configured on server');
          // Still show the button, but it will show an error when clicked
          setIsLoading(false);
          return;
        }
      } catch (vapidError) {
        console.error('VAPID keys not available:', vapidError);
        // Still show the button - user can try to subscribe
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
        // Continue anyway - we'll try to register when user clicks
        registration = null;
      }
      
      if (!registration) {
        // No registration exists, but we can still show the button
        // Registration will happen when user clicks subscribe
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
        // Still show the button - it will register when clicked
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

  // Get FCM token if Firebase is available
  const getFCMToken = async () => {
    try {
      // Wait for Firebase to be initialized (loaded from CDN in index.html)
      // Check if messaging and getToken are available
      if (window.firebaseMessaging && window.firebaseGetToken) {
        const messaging = window.firebaseMessaging;
        const getToken = window.firebaseGetToken;
        
        const serviceWorkerRegistration = await navigator.serviceWorker.getRegistration();
        const currentToken = await getToken(messaging, {
          serviceWorkerRegistration: serviceWorkerRegistration || undefined
        });
        
        if (currentToken) {
          console.log('✅ FCM token obtained:', currentToken.substring(0, 20) + '...');
          return currentToken;
        } else {
          console.log('No FCM token available - user needs to grant notification permission');
          return null;
        }
      } else {
        console.log('Firebase Messaging not initialized yet');
        return null;
      }
    } catch (error) {
      console.warn('Failed to get FCM token:', error);
      // This is OK - FCM might not be available or permission not granted
      return null;
    }
  };

  // Auto-subscribe function (called when app is installed)
  const autoSubscribe = async () => {
    try {
      // Get FCM token if available
      let fcmToken = null;
      try {
        fcmToken = await getFCMToken();
      } catch (fcmError) {
        console.log('FCM token not available (will use Web Push only):', fcmError);
      }
      
      // Get VAPID public key for Web Push
      const response = await getVapidPublicKey();
      if (!response.data || !response.data.publicKey && !fcmToken) {
        return;
      }

      const vapidPublicKey = response.data?.publicKey;

      let subscriptionData = null;
      
      // Try to get Web Push subscription if VAPID key is available
      if (vapidPublicKey) {
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

        // Prepare Web Push subscription data
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
        
        subscriptionData = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: p256dhBase64,
            auth: authBase64
          }
        };
      }
      
      // Send subscription to server (include both Web Push and FCM if available)
      const serverResponse = await subscribeToPush(subscriptionData, fcmToken, 'web');
      
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

      // Get FCM token if Firebase is available
      let fcmToken = null;
      try {
        fcmToken = await getFCMToken();
        if (fcmToken) {
          console.log('✅ FCM token obtained for subscription');
        }
      } catch (fcmError) {
        console.log('FCM token not available (will use Web Push only):', fcmError);
      }

      // Get VAPID public key for Web Push
      console.log('Getting VAPID public key...');
      let response;
      try {
        response = await getVapidPublicKey();
        console.log('VAPID key response:', response);
      } catch (vapidError) {
        console.error('Failed to get VAPID key:', vapidError);
        // If we have FCM token, we can still proceed
        if (!fcmToken) {
          if (vapidError.response?.status === 503) {
            alert('Push notifications are not configured on the server. Please contact the administrator.');
          } else {
            alert('Failed to connect to server. Please check your connection and try again.');
          }
          setIsLoading(false);
          return;
        }
      }

      // Need either VAPID key or FCM token
      if ((!response?.data || !response.data.publicKey) && !fcmToken) {
        alert('Push notifications are not configured on the server.');
        setIsLoading(false);
        return;
      }

      const vapidPublicKey = response?.data?.publicKey;
      console.log('VAPID public key received:', vapidPublicKey.substring(0, 20) + '...');

      let subscriptionData = null;
      
      // Try to get Web Push subscription if VAPID key is available
      if (vapidPublicKey) {
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
            // Try different paths for service worker (for Capacitor compatibility)
            const swPaths = ['/service-worker.js', './service-worker.js', 'service-worker.js'];
            let lastError;
            
            for (const swPath of swPaths) {
              try {
                console.log(`Trying to register service worker at: ${swPath}`);
                registration = await navigator.serviceWorker.register(swPath, {
                  scope: '/'
                });
                console.log('✅ Service Worker registered at:', swPath, registration);
                break; // Success, exit loop
              } catch (pathError) {
                console.warn(`Failed to register at ${swPath}:`, pathError.message);
                lastError = pathError;
                // Continue to next path
              }
            }
            
            if (!registration) {
              throw lastError || new Error('Failed to register service worker at any path');
            }
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
          // If we have FCM token, we can still proceed without Web Push
          if (!fcmToken) {
            if (swError.message === 'Service worker timeout') {
              alert('Service worker took too long to initialize. Please refresh the page and try again.');
            } else {
              alert(`Failed to register service worker: ${swError.message}\n\nPlease check browser console for details.`);
            }
            setIsLoading(false);
            return;
          }
          console.warn('⚠️ Web Push subscription failed, but FCM token is available, proceeding with FCM only');
        }

        // Try Web Push subscription if service worker is available
        if (registration) {
          try {
            // Convert VAPID key
            console.log('Converting VAPID key...');
            console.log('VAPID key length:', vapidPublicKey.length);
            
            let applicationServerKey;
            try {
              applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
              console.log('✅ VAPID key converted successfully, length:', applicationServerKey.length);
            } catch (keyError) {
              console.error('❌ VAPID key conversion error:', keyError);
              console.warn('⚠️ Web Push subscription will be skipped, using FCM only');
            }

            if (applicationServerKey) {
              // Subscribe to push notifications
              console.log('Subscribing to push notifications...');
              
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
                
                // Prepare Web Push subscription data
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
                
                subscriptionData = {
                  endpoint: subscription.endpoint,
                  keys: {
                    p256dh: p256dhBase64,
                    auth: authBase64
                  }
                };
                
                console.log('Web Push subscription data prepared');
              } catch (subError) {
                console.error('❌ Push subscription error:', subError);
                console.warn('⚠️ Web Push subscription failed, will use FCM only if available');
                // Continue with FCM if available
              }
            }
          } catch (err) {
            console.warn('⚠️ Web Push setup failed:', err);
          }
        }
      }

      // Send subscription to server (include both Web Push and FCM if available)
      console.log('Sending subscription to server...');
      try {
        console.log('Subscription data to send:', { 
          hasWebPush: !!subscriptionData,
          hasFcmToken: !!fcmToken,
          endpoint: subscriptionData?.endpoint?.substring(0, 50) + '...'
        });
        
        const response = await subscribeToPush(subscriptionData, fcmToken, 'web');
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

  // Always show the notification card if supported, even if there are errors
  // This ensures users can see and interact with it in the app
  if (!isSupported) {
    const isCapacitor = typeof window !== 'undefined' && (window.Capacitor || window.CapacitorWeb);
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasPushManager = 'PushManager' in window;
    
    // Provide more helpful error message
    let errorMessage = 'Push notifications are not supported in this browser';
    if (isCapacitor && (!hasServiceWorker || !hasPushManager)) {
      errorMessage = 'Push notifications may not be available in this app version. Please update the app or use the web version.';
    } else if (!hasServiceWorker) {
      errorMessage = 'Service workers are not supported in this browser';
    } else if (!hasPushManager) {
      errorMessage = 'Push notifications API is not available in this browser';
    }
    
    return (
      <div className="card" style={{ marginTop: '20px', marginBottom: '20px', opacity: 0.6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h3 style={{ margin: '0 0 5px 0', color: '#f9fafb' }}>🔔 Push Notifications</h3>
            <p style={{ margin: 0, color: '#d1d5db', fontSize: '14px' }}>
              {errorMessage}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ 
      marginTop: '20px', 
      marginBottom: '20px', 
      backgroundColor: '#1f2937', 
      border: '2px solid #3b82f6',
      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <h3 style={{ margin: '0 0 5px 0', color: '#f9fafb', fontSize: '18px', fontWeight: '600' }}>🔔 Push Notifications</h3>
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
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: '600',
            minHeight: '48px',
            minWidth: '160px',
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {isLoading ? 'Loading...' : isSubscribed ? '🔕 Disable' : '🔔 Enable Notifications'}
        </button>
      </div>
    </div>
  );
};

export default PushNotification;

