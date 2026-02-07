// src/app/dashboard/invoices/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useActiveGstin } from "@/hooks/useActiveGstin";

type Invoice = {
  id: string;
  invoiceNumber?: string | null;
  invoiceType: string;
  status: string;
  invoiceDate?: string;
  totalInvoicePaise?: number;
};

export default function InvoicesPage() {
  const { activeId: gstinId } = useActiveGstin();
  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const LIST_API = "/api/invoices"; // ✅ adjust if different

  async function load() {
    if (!gstinId) return;
    try {
      setLoading(true);
      const res = await fetch(`${LIST_API}?gstinId=${encodeURIComponent(gstinId)}`, { cache: "no-store" });
      const json = await res.json();
      setItems(Array.isArray(json) ? json : json.items ?? []);
    } catch (e) {
      console.error("Failed to load invoices", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gstinId]);

  async function createDraft() {
    if (!gstinId) return;
    setCreating(true);
    try {
      // Minimal draft payload — your backend can enrich it
      const res = await fetch(LIST_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerGstinId: gstinId,
          invoiceType: "B2C",
          placeOfSupply: null,
          lineItems: [],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Create failed");

      // Expect { id: "..." }
      window.location.href = `/dashboard/invoices/${json.id}`;
    } catch (e) {
      console.error(e);
      alert("Failed to create draft invoice. Check server logs.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Invoices</h1>
        <button
          onClick={createDraft}
          disabled={!gstinId || creating}
          className="rounded-md border bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {creating ? "Creating…" : "New Draft Invoice"}
        </button>
      </div>

      <div className="rounded-lg border bg-white">
        <div className="border-b px-4 py-2 text-sm text-gray-600">
          {gstinId ? "Showing invoices for active GSTIN" : "Select a GSTIN first"}
        </div>

        {loading ? (
          <div className="p-4 text-sm text-gray-600">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">No invoices yet.</div>
        ) : (
          <div className="divide-y">
            {items.map((inv) => (
              <Link
                key={inv.id}
                href={`/dashboard/invoices/${inv.id}`}
                className="block px-4 py-3 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {inv.invoiceNumber ?? "(draft)"}{" "}
                    <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs">{inv.status}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    ₹{(((inv.totalInvoicePaise ?? 0) / 100) as number).toFixed(2)}
                  </div>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {inv.invoiceType} • {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleString() : ""}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
