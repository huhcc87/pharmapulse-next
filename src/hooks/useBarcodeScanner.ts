"use client";

import { useEffect, useRef } from "react";

type Options = {
  onScan: (code: string) => void;
  minLength?: number;
  timeoutMs?: number;
  terminators?: Array<"Enter" | "Tab">;
};

function isEditableElement(el: Element | null) {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(el as any).isContentEditable;
}

export function useBarcodeScanner(opts: Options) {
  const {
    onScan,
    minLength = 4,
    timeoutMs = 70,
    terminators = ["Enter", "Tab"],
  } = opts;

  const buf = useRef<string>("");
  const lastTs = useRef<number>(0);

  useEffect(() => {
    function commit() {
      const code = buf.current.trim();
      buf.current = "";
      if (code.length >= minLength) onScan(code);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const now = Date.now();
      const dt = now - lastTs.current;
      lastTs.current = now;

      const active = document.activeElement;
      const inEditable = isEditableElement(active);

      if (dt > timeoutMs) {
        buf.current = "";
        if (inEditable) return;
      }

      if (terminators.includes(e.key as "Enter" | "Tab")) {
        if (e.key === "Tab") e.preventDefault(); // stop focus jump
        commit();
        return;
      }

      if (e.key.length === 1) {
        buf.current += e.key;
      }
    }

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true } as any);
  }, [onScan, minLength, timeoutMs, terminators]);
}
