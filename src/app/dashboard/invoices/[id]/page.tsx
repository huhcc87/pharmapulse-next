// src/app/dashboard/invoices/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GstStateSelect } from "@/components/gst/GstStateSelect";
import { useActiveGstin } from "@/hooks/useActiveGstin";
import { gstStateFromGstin } from "@/lib/gstStateCodes";

type LineItem = {
  id?: string;
  productName: string;
  hsnCode: string;
  quantity: number;
  unitPricePaise: number;
  taxablePaise?: number;
  gstRateBps: number;
  cgstPaise?: number;
  sgstPaise?: number;
  igstPaise?: number;
  drugLibraryId?: number | null;
};

type Invoice = {
  id: string;
  invoiceNumber?: string | null;
  invoiceType: string;
  status: string;
  placeOfSupply?: string | null;
  buyerGstin?: string | null;
  totalTaxablePaise?: number;
  totalGstPaise?: number;
  totalInvoicePaise?: number;
  lineItems: LineItem[];
};

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { activeGstin } = useActiveGstin();

  const [inv, setInv] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Handle missing ID
  useEffect(() => {
    if (!id) {
      router.push('/dashboard/invoices');
      return;
    }
  }, [id, router]);

  const GET_API = `/api/invoices/${id || ''}`; // ✅ adjust if different
  const ISSUE_API = `/api/invoices/${id}/issue`; // ✅ must exist
  const CREDIT_NOTE_API = `/api/invoices/${id}/credit-note`; // ✅ optional if you added it

  async function load() {
    try {
      setLoading(true);
      const res = await fetch(GET_API, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Load failed");
      // API returns { invoice: {...} } so extract invoice
      const invoice = json.invoice || json;
      // Ensure lineItems is always an array
      if (!invoice.lineItems || !Array.isArray(invoice.lineItems)) {
        invoice.lineItems = [];
      }
      
      setInv(invoice);
    } catch (e) {
      console.error(e);
      alert("Failed to load invoice. Check API route and logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Default place of supply - Jammu & Kashmir (01) if empty, or seller state for B2C
  useEffect(() => {
    if (inv && !inv.placeOfSupply) {
      let defaultState = "01"; // Default to Jammu & Kashmir
      
      // For B2C, prefer seller state if available
      if (inv.invoiceType === "B2C" && activeGstin?.gstin) {
        const sellerState = gstStateFromGstin(activeGstin.gstin);
        if (sellerState) {
          defaultState = sellerState;
        }
      }
      
      setInv({ ...inv, placeOfSupply: defaultState });
    }
  }, [inv, activeGstin]);

  const totals = useMemo(() => {
    const taxable = inv?.totalTaxablePaise ?? 0;
    const gst = inv?.totalGstPaise ?? 0;
    const total = inv?.totalInvoicePaise ?? 0;
    return {
      taxable: (taxable / 100).toFixed(2),
      gst: (gst / 100).toFixed(2),
      total: (total / 100).toFixed(2),
    };
  }, [inv]);

  async function saveDraft() {
    if (!inv) return;
    
    // Validate required fields
    if (!inv.placeOfSupply) {
      alert("Please select Place of Supply");
      return;
    }
    
    if (!inv.invoiceType) {
      // Auto-determine invoice type
      inv.invoiceType = inv.buyerGstin && inv.buyerGstin.length >= 10 ? "B2B" : "B2C";
    }
    
    setSaving(true);
    try {
      const res = await fetch(GET_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inv),
      });
      
      // Read response body only once
      let responseText = "";
      try {
        responseText = await res.text();
      } catch (e: any) {
        throw new Error("Failed to read server response");
      }
      
      // Check if response is ok
      if (!res.ok) {
        let errorMessage = "Save failed";
        if (responseText) {
          try {
            const errorJson = JSON.parse(responseText);
            errorMessage = errorJson?.error || errorJson?.message || errorMessage;
          } catch {
            errorMessage = responseText;
          }
        }
        throw new Error(errorMessage);
      }
      
      // Parse JSON from already-read text
      if (!responseText || responseText.trim() === "") {
        throw new Error("Empty response from server");
      }
      
      let json;
      try {
        json = JSON.parse(responseText);
      } catch (parseError: any) {
        console.error("JSON parse error:", parseError);
        throw new Error("Invalid response from server. Please try again.");
      }
      
      setInv(json.invoice || json);
      alert("Saved");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Save failed. Check PUT handler in /api/invoices/[id].");
    } finally {
      setSaving(false);
    }
  }

  async function issueInvoice() {
    setSaving(true);
    try {
      const res = await fetch(ISSUE_API, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Issue failed");
      setInv(json);
      alert("Invoice issued");
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Issue failed. Ensure /api/invoices/[id]/issue exists.");
    } finally {
      setSaving(false);
    }
  }

  async function createCreditNote() {
    setSaving(true);
    try {
      const res = await fetch(CREDIT_NOTE_API, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Credit note failed");
      window.location.href = `/dashboard/invoices/${json.id}`;
    } catch (e) {
      console.error(e);
      alert("Credit note failed. Ensure endpoint exists.");
    } finally {
      setSaving(false);
    }
  }

  async function updateLineItem(idx: number, patch: Partial<LineItem>) {
    if (!inv) return;
    const next = [...inv.lineItems];
    const item = next[idx];
    
    // Auto-fetch HSN if drugLibraryId is set and HSN is missing
    if (patch.drugLibraryId && !item.hsnCode && !patch.hsnCode) {
      try {
        const res = await fetch(`/api/drug-library/${patch.drugLibraryId}/hsn`);
        if (res.ok) {
          const hsnData = await res.json();
          patch.hsnCode = hsnData.hsnCode;
          if (!patch.gstRateBps && hsnData.gstRate) {
            patch.gstRateBps = Math.round(hsnData.gstRate * 100);
          }
        }
      } catch (e) {
        console.error("Failed to fetch HSN:", e);
      }
    }
    
    next[idx] = { ...item, ...patch };
    setInv({ ...inv, lineItems: next });
  }

  function addLineItem() {
    if (!inv) return;
    setInv({
      ...inv,
      lineItems: [
        ...inv.lineItems,
        {
          productName: "",
          hsnCode: "",
          quantity: 1,
          unitPricePaise: 0,
          gstRateBps: 1200, // Default 12% GST
        },
      ],
    });
  }

  function removeLineItem(idx: number) {
    if (!inv) return;
    const next = inv.lineItems.filter((_, i) => i !== idx);
    setInv({ ...inv, lineItems: next });
  }

  if (loading) return <div className="text-sm text-gray-600">Loading…</div>;
  if (!inv) return <div className="text-sm text-gray-600">Not found.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {inv.invoiceNumber ?? "(Draft Invoice)"}{" "}
            <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs">{inv.status}</span>
          </h1>
          <div className="mt-1 text-xs text-gray-500">{inv.invoiceType}</div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={saveDraft}
            disabled={saving}
            className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>

          <button
            onClick={issueInvoice}
            disabled={saving || inv.status !== "DRAFT"}
            className="rounded-md border bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Issue
          </button>

          <button
            onClick={createCreditNote}
            disabled={saving || inv.status !== "ISSUED"}
            className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
          >
            Create Credit Note
          </button>

          <button
            onClick={async () => {
              try {
                console.log("Downloading PDF for invoice:", id);
                const res = await fetch(`/api/invoices/${id}/pdf`);
                console.log("PDF response status:", res.status);
                
                // Check content type first (doesn't consume body)
                const contentType = res.headers.get("content-type");
                
                if (!res.ok) {
                  let errorMessage = "Failed to download PDF";
                  try {
                    const errorText = await res.text();
                    if (errorText) {
                      try {
                        const errorJson = JSON.parse(errorText);
                        errorMessage = errorJson?.error || errorJson?.message || errorMessage;
                      } catch {
                        errorMessage = errorText;
                      }
                    }
                  } catch (e) {
                    console.error("Error reading error response:", e);
                  }
                  alert(errorMessage);
                  return;
                }
                
                // Check if response is actually a PDF
                if (!contentType || !contentType.includes("application/pdf")) {
                  // Clone response to read error text without consuming original
                  const clonedRes = res.clone();
                  try {
                    const errorText = await clonedRes.text();
                    console.error("Expected PDF but got:", contentType, errorText);
                    alert("Server returned invalid PDF format. Please try again.");
                  } catch {
                    alert("Server returned invalid PDF format. Please try again.");
                  }
                  return;
                }
                
                const blob = await res.blob();
                
                if (blob.size === 0) {
                  alert("PDF file is empty. Please try again.");
                  return;
                }
                
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `invoice-${inv?.invoiceNumber || id}.pdf`;
                document.body.appendChild(a);
                a.click();
                
                // Cleanup
                setTimeout(() => {
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                }, 100);
                
                console.log("PDF downloaded successfully");
              } catch (e: any) {
                console.error("PDF download error:", e);
                alert(e?.message || "Failed to download PDF. Check console for details.");
              }
            }}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
          >
            Download PDF
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <div className="text-sm font-medium">Party / GST</div>

          <label className="block text-sm">
            <div className="text-xs text-gray-500">Place of Supply (state code)</div>
            <div className="mt-1">
              <GstStateSelect
                value={inv.placeOfSupply ?? undefined}
                onChange={(code) => setInv({ ...inv, placeOfSupply: code })}
                placeholder="Select state code…"
              />
            </div>
          </label>

          <label className="block text-sm">
            <div className="text-xs text-gray-500">Buyer GSTIN (B2B)</div>
            <input
              className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
              value={inv.buyerGstin ?? ""}
              onChange={(e) => setInv({ ...inv, buyerGstin: e.target.value })}
              placeholder="Optional for B2C"
            />
          </label>
        </div>

        <div className="rounded-lg border bg-white p-4 space-y-2">
          <div className="text-sm font-medium">Totals</div>
          <div className="text-sm text-gray-700">Taxable: ₹{totals.taxable}</div>
          <div className="text-sm text-gray-700">GST: ₹{totals.gst}</div>
          <div className="text-sm font-semibold">Total: ₹{totals.total}</div>
          <div className="text-xs text-gray-500">
            Totals are computed by your backend GST engine when you Save / Issue.
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="text-sm font-medium">Line Items</div>
          <button onClick={addLineItem} className="rounded-md border px-2 py-1 text-sm">
            + Add item
          </button>
        </div>

        {(!inv.lineItems || !Array.isArray(inv.lineItems) || inv.lineItems.length === 0) ? (
          <div className="p-4 text-sm text-gray-600">No items yet.</div>
        ) : (
          <div className="divide-y">
            {inv.lineItems.map((li, idx) => (
              <div key={idx} className="grid gap-2 p-4 md:grid-cols-6">
                <input
                  className="rounded-md border px-2 py-2 text-sm md:col-span-2"
                  value={li.productName}
                  onChange={(e) => updateLineItem(idx, { productName: e.target.value })}
                  placeholder="Product name"
                />
                <input
                  className="rounded-md border px-2 py-2 text-sm"
                  value={li.hsnCode}
                  onChange={(e) => updateLineItem(idx, { hsnCode: e.target.value })}
                  placeholder="HSN"
                />
                <input
                  type="number"
                  className="rounded-md border px-2 py-2 text-sm"
                  value={li.quantity}
                  onChange={(e) => updateLineItem(idx, { quantity: Number(e.target.value) })}
                  placeholder="Qty"
                />
                <input
                  type="number"
                  className="rounded-md border px-2 py-2 text-sm"
                  value={(li.unitPricePaise ?? 0) / 100}
                  onChange={(e) => updateLineItem(idx, { unitPricePaise: Math.round(Number(e.target.value) * 100) })}
                  placeholder="Unit ₹"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="w-full rounded-md border px-2 py-2 text-sm"
                    value={(li.gstRateBps ?? 0) / 100}
                    onChange={(e) => updateLineItem(idx, { gstRateBps: Math.round(Number(e.target.value) * 100) })}
                    placeholder="GST %"
                  />
                  <button onClick={() => removeLineItem(idx)} className="rounded-md border px-2 py-2 text-sm">
                    ✕
                  </button>
                </div>

                <div className="md:col-span-6 text-xs text-gray-500">
                  Unit Price: ₹{((li.unitPricePaise ?? 0) / 100).toFixed(2)} • 
                  Taxable: ₹{((li.taxablePaise ?? 0) / 100).toFixed(2)} • 
                  CGST: ₹{((li.cgstPaise ?? 0) / 100).toFixed(2)} • 
                  SGST: ₹{((li.sgstPaise ?? 0) / 100).toFixed(2)} • 
                  IGST: ₹{((li.igstPaise ?? 0) / 100).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
