"use client";

import Link from "next/link";
import { useActiveGstin } from "@/hooks/useActiveGstin";

export default function GstinSelector() {
  const { gstins: items, activeId, setActive: setActiveGstinId, loading } = useActiveGstin();

  if (loading) return <div className="text-sm text-gray-500">Loading GSTIN…</div>;

  return (
    <div className="flex items-center gap-2">
      <div className="text-sm text-gray-500">Active GSTIN</div>

      {items.length === 0 ? (
        <Link
          href="/dashboard/gst"
          className="rounded-lg border px-3 py-1 text-sm"
          title="Add GSTIN"
        >
          No GSTINs
        </Link>
      ) : (
        <select
          className="rounded-lg border px-3 py-1 text-sm"
          value={activeId ?? ""}
          onChange={(e) => setActiveGstinId(Number(e.target.value))}
        >
          {items.map((g) => (
            <option key={g.id} value={g.id}>
              {g.gstin}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
