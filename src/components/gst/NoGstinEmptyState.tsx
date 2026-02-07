"use client";

import Link from "next/link";

export default function NoGstinEmptyState() {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-sm font-semibold">No GSTIN found</div>
      <div className="mt-1 text-sm text-gray-600">
        Add your GSTIN once, then PharmaPulse will auto-calculate GST and enable invoicing + returns.
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/dashboard/gst"
          className="rounded-lg bg-black px-3 py-2 text-sm text-white"
        >
          Add GSTIN
        </Link>

        <Link
          href="/dashboard/invoices"
          className="rounded-lg border px-3 py-2 text-sm"
        >
          Go to Invoices
        </Link>
      </div>
    </div>
  );
}
