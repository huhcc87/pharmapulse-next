// Service Worker Registration for PWA
// Registers service worker and sets up background sync

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('Service Workers are not supported in this environment');
    return Promise.resolve(null);
  }

  return navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((registration) => {
      console.log('[PWA] Service Worker registered:', registration.scope);

      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000); // Check every hour

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              console.log('[PWA] New service worker available. Reload to update.');
              // Optionally show update notification to user
            }
          });
        }
      });

      return registration;
    })
    .catch((error) => {
      console.error('[PWA] Service Worker registration failed:', error);
      return null;
    });
}

/**
 * Setup background sync for offline queue
 */
export async function setupBackgroundSync(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Register for background sync (if supported)
    if ('sync' in (registration as any)) {
      try {
        await (registration as any).sync.register('offline-sync');
        console.log('[PWA] Background sync registered');
      } catch (error) {
        // Background sync may not be supported
        console.warn('[PWA] Background sync not available:', error);
      }
    }
  } catch (error) {
    console.error('[PWA] Background sync setup failed:', error);
  }
}

/**
 * Unregister service worker (for development/testing)
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const result = await registration.unregister();
    console.log('[PWA] Service Worker unregistered');
    return result;
  } catch (error) {
    console.error('[PWA] Service Worker unregistration failed:', error);
    return false;
  }
}

/**
 * Initialize PWA features
 */
export async function initializePWA(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  // Register service worker
  const registration = await registerServiceWorker();
  
  if (registration) {
    // Setup background sync
    await setupBackgroundSync();
    
    // Listen for online/offline events to trigger sync
    window.addEventListener('online', () => {
      console.log('[PWA] Online - triggering sync');
      // Sync will be handled by offline/sync-engine
    });
  }
}
