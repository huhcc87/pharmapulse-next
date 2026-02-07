// Real-time Notifications System
// Uses Server-Sent Events (SSE) for real-time updates

export type NotificationType = 
  | "VIDEO_CALL_INCOMING"
  | "VIDEO_CALL_ACCEPTED"
  | "VIDEO_CALL_ENDED"
  | "STOCK_ALERT"
  | "EXPIRY_ALERT"
  | "ORDER_UPDATE"
  | "PAYMENT_RECEIVED";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  timestamp: Date;
  read: boolean;
}

export class NotificationService {
  private eventSource: EventSource | null = null;
  private listeners: Map<NotificationType, Array<(notification: Notification) => void>> = new Map();

  constructor(private userId: string, private tenantId: number) {}

  /**
   * Connect to notification stream
   */
  connect(): void {
    if (typeof window === "undefined") return;

    const url = `/api/realtime/notifications?userId=${this.userId}&tenantId=${this.tenantId}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      try {
        const notification: Notification = JSON.parse(event.data);
        this.handleNotification(notification);
      } catch (error) {
        console.error("Error parsing notification:", error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          this.connect();
        }
      }, 5000);
    };
  }

  /**
   * Disconnect from notification stream
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Subscribe to specific notification types
   */
  subscribe(type: NotificationType, callback: (notification: Notification) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(type);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  private handleNotification(notification: Notification): void {
    const callbacks = this.listeners.get(notification.type);
    if (callbacks) {
      callbacks.forEach((callback) => callback(notification));
    }

    // Also notify all listeners (for general notifications)
    const allCallbacks = this.listeners.get(notification.type as any);
    if (allCallbacks) {
      allCallbacks.forEach((callback) => callback(notification));
    }
  }

  /**
   * Send a notification (client-side, for testing)
   */
  async sendNotification(notification: Omit<Notification, "id" | "timestamp" | "read">): Promise<void> {
    await fetch("/api/realtime/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notification),
    });
  }
}
