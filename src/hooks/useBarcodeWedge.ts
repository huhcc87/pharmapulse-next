// src/hooks/useBarcodeWedge.ts
"use client";

import { useEffect, useRef } from "react";

export function useBarcodeWedge(onScan: (code: string) => void, opts?: { minLen?: number; timeoutMs?: number }) {
  const bufferRef = useRef("");
  const lastAtRef = useRef(0);

  const minLen = opts?.minLen ?? 6;
  const timeoutMs = opts?.timeoutMs ?? 60;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input/textarea (unless it's a scanner-specific field)
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        // Only ignore if it's a normal input (not a scanner field)
        // Scanner fields should have data-scanner="true" attribute
        if (!target.hasAttribute('data-scanner')) {
          // Reset buffer if user is typing manually
          bufferRef.current = "";
          return;
        }
      }

      // ignore if user is typing slowly
      const now = Date.now();
      if (now - lastAtRef.current > timeoutMs) {
        bufferRef.current = "";
      }
      lastAtRef.current = now;

      // scanner often ends with Enter
      if (e.key === "Enter") {
        const code = bufferRef.current.trim();
        bufferRef.current = "";
        if (code.length >= minLen) {
          console.log("📡 Scanner detected code:", code);
          // Prevent default Enter behavior
          e.preventDefault();
          e.stopPropagation();
          onScan(code);
        }
        return;
      }

      // accept normal characters (alphanumeric and common barcode chars)
      // Also accept special chars that might be in barcodes
      if (e.key.length === 1) {
        // Allow alphanumeric, hyphens, underscores, and other common barcode chars
        if (/[a-zA-Z0-9\-_\.\/]/.test(e.key)) {
          bufferRef.current += e.key;
        }
      } else if (e.key === "Backspace") {
        // Allow backspace to correct scanner input
        bufferRef.current = bufferRef.current.slice(0, -1);
      }
    }

    window.addEventListener("keydown", onKeyDown, true); // Use capture phase
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [minLen, onScan, timeoutMs]);
}
