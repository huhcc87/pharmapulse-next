"use client";

import { useEffect, useRef } from "react";

type Options = {
  onScan: (code: string) => void;
  minLength?: number;
  timeoutMs?: number; // max interval between characters
};

/**
 * Works with USB/Bluetooth HID scanners ("keyboard wedge").
 * Captures fast key bursts and commits on Enter.
 * Safer than relying on focused <input>, but you can also use the input approach.
 */
export function useBarcodeScanner(opts: Options) {
  const { onScan, minLength = 4, timeoutMs = 50 } = opts;

  const buf = useRef<string>("");
  const lastTs = useRef<number>(0);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing normally (slow) or using modifiers
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const now = Date.now();
      const dt = now - lastTs.current;
      lastTs.current = now;

      if (dt > timeoutMs) {
        // too slow -> reset buffer (likely manual typing)
        buf.current = "";
      }

      if (e.key === "Enter") {
        const code = buf.current.trim();
        buf.current = "";
        if (code.length >= minLength) onScan(code);
        return;
      }

      // Accept typical barcode characters
      if (e.key.length === 1) {
        buf.current += e.key;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onScan, minLength, timeoutMs]);
}
