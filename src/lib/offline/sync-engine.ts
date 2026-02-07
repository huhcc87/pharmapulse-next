// Client-side sync engine for offline queue

import {
  getQueuedInvoices,
  getQueuedEvents,
  updateInvoiceStatus,
} from "./indexeddb";
import { verifyOfflineToken } from "./token";

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000; // 1 second

/**
 * Exponential backoff delay
 */
function getBackoffDelay(attempt: number): number {
  return INITIAL_BACKOFF_MS * Math.pow(2, attempt);
}

/**
 * Sync offline queue to server
 */
export async function syncOfflineQueue(): Promise<{
  succeeded: number;
  failed: number;
  needsReview: number;
}> {
  // Get stored offline token
  const token = localStorage.getItem("offline_token");
  if (!token) {
    throw new Error("No offline token found");
  }

  // Verify token is still valid
  const tokenPayload = verifyOfflineToken(token);
  if (!tokenPayload) {
    throw new Error("Offline token expired or invalid");
  }

  // Get queued items
  const invoices = await getQueuedInvoices();
  const events = await getQueuedEvents();

  if (invoices.length === 0 && events.length === 0) {
    return { succeeded: 0, failed: 0, needsReview: 0 };
  }

  // Prepare sync payload
  const syncPayload = {
    token,
    invoices: invoices.map((inv) => ({
      localId: inv.localId,
      idempotencyKey: inv.idempotencyKey,
      invoiceData: inv.invoiceData,
    })),
    events: events.map((evt) => ({
      localId: evt.localId,
      idempotencyKey: evt.idempotencyKey,
      eventType: evt.eventType,
      eventData: evt.eventData,
    })),
  };

  let attempt = 0;
  let lastError: Error | null = null;

  // Retry with exponential backoff
  while (attempt < MAX_RETRIES) {
    try {
      const response = await fetch("/api/offline/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(syncPayload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Sync failed");
      }

      const result = await response.json();

      // Update local status based on results
      for (const itemResult of result.results || []) {
        if (itemResult.localId) {
          if (itemResult.status === "SYNCED") {
            await updateInvoiceStatus(
              itemResult.localId,
              "SYNCED",
              itemResult.serverInvoiceId
            );
          } else if (itemResult.status === "NEEDS_REVIEW") {
            await updateInvoiceStatus(
              itemResult.localId,
              "QUEUED", // Keep as QUEUED but with conflict details
              undefined,
              itemResult.conflicts
            );
          } else if (itemResult.status === "FAILED") {
            await updateInvoiceStatus(itemResult.localId, "FAILED");
          }
        }
      }

      return {
        succeeded: result.summary?.succeeded || 0,
        failed: result.summary?.failed || 0,
        needsReview: result.summary?.needsReview || 0,
      };
    } catch (error: any) {
      lastError = error;
      attempt++;

      if (attempt < MAX_RETRIES) {
        const delay = getBackoffDelay(attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  throw lastError || new Error("Sync failed after retries");
}

/**
 * Setup background sync using Service Worker (if available)
 */
export function setupBackgroundSync() {
  if ("serviceWorker" in navigator && "sync" in (window as any).ServiceWorkerRegistration?.prototype) {
    navigator.serviceWorker.ready.then((registration) => {
      // Register for periodic background sync
      (registration as any).sync
        .register("offline-sync")
        .then(() => {
          console.log("Background sync registered");
        })
        .catch((error: any) => {
          console.error("Background sync registration failed:", error);
        });
    });
  }

  // Also listen for online event
  window.addEventListener("online", () => {
    syncOfflineQueue().catch((error) => {
      console.error("Auto-sync on reconnection failed:", error);
    });
  });
}
