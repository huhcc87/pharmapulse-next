import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
  size?: "sm" | "md" | "lg";
}

export function Button({ className, variant = "default", size = "md", ...props }: ButtonProps) {
  const v =
    variant === "secondary"
      ? "bg-slate-200 text-slate-900 hover:bg-slate-300"
      : variant === "destructive"
      ? "bg-red-600 text-white hover:bg-red-700"
      : variant === "outline"
      ? "border border-slate-300 hover:bg-slate-50"
      : "bg-slate-900 text-white hover:bg-slate-800";

  const s = size === "sm" ? "h-8 px-3 text-sm" : size === "lg" ? "h-11 px-6 text-base" : "h-9 px-4 text-sm";

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50 disabled:pointer-events-none",
        v,
        s,
        className
      )}
      {...props}
    />
  );
}
