"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

export type ToastState = {
  message: string;
  kind?: "success" | "error" | "info";
  show: boolean;
};

export function Toast({
  state,
  onHide,
}: {
  state: ToastState;
  onHide: () => void;
}) {
  useEffect(() => {
    if (!state.show) return;
    const t = setTimeout(() => onHide(), 2200);
    return () => clearTimeout(t);
  }, [state.show, onHide]);

  if (!state.show) return null;

  const color =
    state.kind === "error"
      ? "bg-red-600 text-white"
      : state.kind === "success"
      ? "bg-emerald-600 text-white"
      : "bg-slate-900 text-white";

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className={cn("rounded-lg px-4 py-2 shadow-lg text-sm", color)}>
        {state.message}
      </div>
    </div>
  );
}
