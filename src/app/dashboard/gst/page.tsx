// src/app/dashboard/gst/page.tsx
"use client";

import { useState } from "react";
import { useActiveGstin } from "@/hooks/useActiveGstin";

export default function GstDashboardPage() {
  const { activeId: gstinId } = useActiveGstin();
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return ym;
  });
  const [busy, setBusy] = useState(false);

  // ✅ Change these if your endpoints differ
  const GSTR1_API = "/api/returns/gstr1";
  const GSTR3B_API = "/api/returns/gstr3b";
  const EXPORT_PACK_API = "/api/gst/export-pack";

  async function run(endpoint: string) {
    if (!gstinId) return alert("Select an Active GSTIN first.");
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gstinId, period }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed");
      alert("Done");
    } catch (e) {
      console.error(e);
      alert("Failed. Check API route and server logs.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadExportPack() {
    if (!gstinId) return alert("Select an Active GSTIN first.");
    setBusy(true);
    try {
      const res = await fetch(EXPORT_PACK_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gstinId, period }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CA_export_${period}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Export pack failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">GST</h1>

      <div className="rounded-lg border bg-white p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <div className="text-xs text-gray-500">Filing period</div>
            <input
              className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="YYYY-MM"
            />
          </label>

          <div className="md:col-span-2 flex flex-wrap gap-2 items-end">
            <button
              disabled={busy}
              onClick={() => run(GSTR1_API)}
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            >
              Generate GSTR-1
            </button>
            <button
              disabled={busy}
              onClick={() => run(GSTR3B_API)}
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            >
              Generate GSTR-3B
            </button>
            <button
              disabled={busy}
              onClick={downloadExportPack}
              className="rounded-md border bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Download CA Export Pack
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          Active GSTIN is required. Returns are generated from issued invoices within the selected period.
        </div>
      </div>
    </div>
  );
}
