"use client";

import { useActiveGstin } from "@/hooks/useActiveGstin";
import Link from "next/link";

export default function GstinSwitcher() {
  const { loading, hasGstins, gstins, activeId, setActive } = useActiveGstin();

  if (loading) {
    return <div className="text-sm text-gray-500">Loading GSTIN…</div>;
  }

  if (!hasGstins) {
    return (
      <div className="flex items-center gap-2">
        <div className="text-sm text-gray-500">Active GSTIN</div>
        <Link
          href="/dashboard/gst"
          className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
        >
          No GSTINs
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="text-sm text-gray-500">Active GSTIN</div>
      <select
        className="rounded-md border px-3 py-1 text-sm bg-white"
        value={activeId ?? ""}
        onChange={(e) => setActive(Number(e.target.value))}
      >
        {gstins.map((g) => (
          <option key={g.id} value={g.id}>
            {g.gstin}
          </option>
        ))}
      </select>
    </div>
  );
}
