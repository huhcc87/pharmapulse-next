"use client";

import { useEffect } from "react";
import { initializePWA } from "@/lib/pwa/register-service-worker";

/**
 * Client component to register Service Worker
 * Must be client-side only (runs in browser)
 */
export default function PWARegistration() {
  useEffect(() => {
    // Only run in browser
    if (typeof window !== 'undefined') {
      initializePWA().catch((error) => {
        console.error('[PWA] Initialization failed:', error);
      });
    }
  }, []);

  // This component doesn't render anything
  return null;
}
