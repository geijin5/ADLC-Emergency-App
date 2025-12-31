// Utility functions for automatic push notification subscription

/**
 * Detects if the app is running as an installed PWA or Capacitor app
 */
export const isAppInstalled = () => {
  // Check for Capacitor (native app)
  if (typeof window !== 'undefined') {
    if (window.Capacitor || window.CapacitorWeb) {
      return true;
    }
    
    // Check if URL protocol indicates native app
    if (window.location && (
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:'
    )) {
      return true;
    }
    
    // Check for PWA standalone mode (installed on home screen)
    // On iOS Safari: window.navigator.standalone
    // On Android Chrome: window.matchMedia('(display-mode: standalone)').matches
    // On desktop Chrome: window.matchMedia('(display-mode: standalone)').matches
    if (window.navigator.standalone === true) {
      return true;
    }
    
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
    
    // Check if launched from home screen (user agent hints)
    if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) {
      return true;
    }
  }
  
  return false;
};

/**
 * Automatically subscribes to push notifications when app is installed
 * This will only work if notification permission is already granted,
 * or if the browser allows permission request (some browsers require user gesture)
 */
export const autoSubscribeToPush = async (subscribeFunction) => {
  // Only auto-subscribe if app is installed
  if (!isAppInstalled()) {
    return false;
  }
  
  // Check if push notifications are supported
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }
  
  // Check notification permission status
  if (Notification.permission === 'granted') {
    // Permission already granted, we can auto-subscribe
    try {
      await subscribeFunction();
      return true;
    } catch (error) {
      console.error('Auto-subscribe failed:', error);
      return false;
    }
  } else if (Notification.permission === 'default') {
    // Permission not yet requested, try to request it
    // Note: Some browsers require user interaction, so this might fail silently
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await subscribeFunction();
        return true;
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }
  
  // Permission was denied, don't auto-subscribe
  return false;
};

