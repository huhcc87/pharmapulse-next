// src/lib/pwa/push-notifications.ts
// PWA Push Notifications
// Web Push API integration for browser notifications

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export class PushNotificationManager {
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;

  /**
   * Initialize push notifications
   */
  async initialize(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    if (!("serviceWorker" in navigator)) return false;
    if (!("PushManager" in window)) return false;
    if (!("Notification" in window)) return false;

    try {
      // Service worker should already be registered elsewhere; wait until ready
      this.registration = await navigator.serviceWorker.ready;

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return false;

      // Get existing subscription or create new one
      this.subscription = await this.registration.pushManager.getSubscription();
      if (!this.subscription) {
        this.subscription = await this.createSubscription();
      }

      return this.subscription !== null;
    } catch (error) {
      console.error("Error initializing push notifications:", error);
      return false;
    }
  }

  /**
   * Create new push subscription
   */
  private async createSubscription(): Promise<PushSubscription | null> {
    if (!this.registration) return null;

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
    if (!vapidPublicKey) {
      console.warn(
        "NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing. Push subscription not created."
      );
      return null;
    }

    try {
      // IMPORTANT:
      // Return ArrayBuffer so TS accepts it as BufferSource without ArrayBufferLike/SharedArrayBuffer mismatch.
      const applicationServerKey = this.urlBase64ToArrayBuffer(vapidPublicKey);

      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey, // ArrayBuffer is a valid BufferSource
      });

      return subscription;
    } catch (error) {
      console.error("Error creating push subscription:", error);
      return null;
    }
  }

  /**
   * Get subscription data for server
   */
  async getSubscriptionData(): Promise<PushSubscriptionData | null> {
    if (!this.subscription) {
      await this.initialize();
    }
    if (!this.subscription) return null;

    const key = this.subscription.getKey("p256dh");
    const auth = this.subscription.getKey("auth");
    if (!key || !auth) return null;

    return {
      endpoint: this.subscription.endpoint,
      keys: {
        p256dh: this.arrayBufferToBase64(key),
        auth: this.arrayBufferToBase64(auth),
      },
    };
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) return false;

    try {
      await this.subscription.unsubscribe();
      this.subscription = null;
      return true;
    } catch (error) {
      console.error("Error unsubscribing:", error);
      return false;
    }
  }

  /**
   * Check if notifications are supported
   */
  isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }

  /**
   * Check notification permission
   */
  async getPermission(): Promise<NotificationPermission> {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "denied";
    }
    return Notification.permission;
  }

  /**
   * Convert VAPID key from base64url to ArrayBuffer (BufferSource-safe for TS)
   */
  private urlBase64ToArrayBuffer(base64UrlString: string): ArrayBuffer {
    const padding = "=".repeat((4 - (base64UrlString.length % 4)) % 4);
    const base64 = (base64UrlString + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const raw = window.atob(base64);

    // Uint8Array is backed by a real ArrayBuffer
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }

    return bytes.buffer;
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}

// Singleton instance
let pushManagerInstance: PushNotificationManager | null = null;

export function getPushNotificationManager(): PushNotificationManager {
  if (!pushManagerInstance) {
    pushManagerInstance = new PushNotificationManager();
  }
  return pushManagerInstance;
}
