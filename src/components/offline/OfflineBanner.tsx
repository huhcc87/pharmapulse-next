"use client";

import { useState, useEffect } from "react";
import { WifiOff, Wifi, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface OfflineBannerProps {
  onSyncClick?: () => void;
}

export default function OfflineBanner({ onSyncClick }: OfflineBannerProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Check online status
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check queue count periodically
    const checkQueue = async () => {
      try {
        const { getQueuedInvoices, getQueuedEvents } = await import("@/lib/offline/indexeddb");
        const invoices = await getQueuedInvoices();
        const events = await getQueuedEvents();
        setQueuedCount(invoices.length + events.length);
      } catch (error) {
        console.error("Failed to check queue:", error);
      }
    };

    checkQueue();
    const interval = setInterval(checkQueue, 5000); // Check every 5 seconds

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Trigger sync
      if (onSyncClick) {
        onSyncClick();
      } else {
        // Default sync behavior
        const { syncOfflineQueue } = await import("@/lib/offline/sync-engine");
        await syncOfflineQueue();
      }
      // Refresh queue count
      const { getQueuedInvoices, getQueuedEvents } = await import("@/lib/offline/indexeddb");
      const invoices = await getQueuedInvoices();
      const events = await getQueuedEvents();
      setQueuedCount(invoices.length + events.length);
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isOnline && queuedCount === 0) {
    return null; // Don't show banner when online and no queue
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 p-3 border-b ${
        !isOnline
          ? "bg-orange-100 border-orange-300 text-orange-900"
          : queuedCount > 0
          ? "bg-blue-100 border-blue-300 text-blue-900"
          : "bg-green-100 border-green-300 text-green-900"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!isOnline ? (
            <WifiOff className="w-5 h-5" />
          ) : queuedCount > 0 ? (
            <AlertCircle className="w-5 h-5" />
          ) : (
            <Wifi className="w-5 h-5" />
          )}
          <div>
            <div className="font-semibold text-sm">
              {!isOnline
                ? "You're offline. Invoices will be queued."
                : queuedCount > 0
                ? `${queuedCount} item(s) pending sync`
                : "All synced"}
            </div>
            {!isOnline && (
              <div className="text-xs mt-0.5">
                Working in offline mode. Data will sync when connection is restored.
              </div>
            )}
          </div>
          {queuedCount > 0 && (
            <Badge variant="outline" className="bg-white">
              {queuedCount} pending
            </Badge>
          )}
        </div>

        {isOnline && queuedCount > 0 && (
          <Button
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            variant="outline"
            className="bg-white"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Now
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
