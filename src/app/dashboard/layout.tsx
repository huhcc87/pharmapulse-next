// src/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import GstinSwitcher from "@/components/gst/GstinSwitcher";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold">PharmaPulse</div>
            <div className="text-sm text-gray-500">Dashboard</div>
          </div>

          <div className="flex items-center gap-3">
            <GstinSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
