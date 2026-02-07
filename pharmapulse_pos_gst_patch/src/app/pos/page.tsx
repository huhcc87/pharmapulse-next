"use client";

import { useCallback, useMemo, useState } from "react";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useCartStore } from "@/store/useCartStore";
import { bucketTaxes, type GSTContext } from "@/lib/gst";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type ProductDTO = {
  id: string;
  name: string;
  barcode?: string | null;
  hsn?: string | null;
  gstRate?: number | null;
  taxInclusion: "EXCLUSIVE" | "INCLUSIVE";
  salePrice: number;
};

export default function POSPage() {
  const { items, addOrIncrement, setQty, setPrice, setDiscount, remove, clear } = useCartStore();
  const [sellerStateCode, setSellerStateCode] = useState("27");
  const [buyerStateCode, setBuyerStateCode] = useState("27");
  const [buyerGstin, setBuyerGstin] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("Ready.");

  const ctx: GSTContext = useMemo(
    () => ({ sellerStateCode, buyerStateCode }),
    [sellerStateCode, buyerStateCode]
  );

  const lines = useMemo(() => {
    return items.map((x: any) => ({
      hsn: x.hsn ?? null,
      qty: x.qty,
      unitPrice: x.unitPrice,
      discount: x.discount,
      gstRate: x.gstRate ?? 0,
      taxInclusion: x.taxInclusion || "EXCLUSIVE",
      gstType: x.taxInclusion || "EXCLUSIVE", // Map taxInclusion to gstType for bucketTaxes
    }));
  }, [items]);

  const totals = useMemo(() => bucketTaxes(lines, ctx), [lines, ctx]);

  const fetchByBarcode = useCallback(async (code: string) => {
    setStatus(`Scanning: ${code} ...`);
    const res = await fetch(`/api/pos/product?barcode=${encodeURIComponent(code)}`);
    if (!res.ok) {
      setStatus(`Not found: ${code}`);
      return;
    }
    const p: ProductDTO = await res.json();
    addOrIncrement({
      id: String(p.id),
      name: p.name,
      barcode: p.barcode,
      hsn: p.hsn,
      gstRate: p.gstRate,
      taxInclusion: (p as any).taxInclusion || "EXCLUSIVE",
      unitPrice: p.salePrice,
    } as any);
    setStatus(`Added: ${p.name}`);
  }, [addOrIncrement]);

  useBarcodeScanner({
    onScan: fetchByBarcode,
    minLength: 4,
    timeoutMs: 50,
  });

  async function onSearchAdd() {
    const q = search.trim();
    if (!q) return;
    setStatus("Searching...");
    const res = await fetch(`/api/pos/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) {
      setStatus("Search failed.");
      return;
    }
    const list: ProductDTO[] = await res.json();
    if (!list.length) {
      setStatus("No results.");
      return;
    }
    const p = list[0];
    addOrIncrement({
      id: String(p.id),
      name: p.name,
      barcode: p.barcode,
      hsn: p.hsn,
      gstRate: p.gstRate,
      taxInclusion: (p as any).taxInclusion || "EXCLUSIVE",
      unitPrice: p.salePrice,
    } as any);
    setSearch("");
    setStatus(`Added: ${p.name}`);
  }

  async function checkout(method: "CASH" | "CARD" | "UPI") {
    if (!items.length) return;

    setStatus("Creating invoice...");
    const res = await fetch("/api/pos/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sellerStateCode,
        buyerStateCode,
        buyerGstin: buyerGstin || null,
        items,
        payment: { method, amount: totals.grandTotal },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      setStatus(`Checkout failed: ${t}`);
      return;
    }

    const out = await res.json();
    setStatus(`Paid. Invoice: ${out.invoiceNo}`);

    // Print via browser (fallback)
    // Better: send to local print bridge (see docs)
    window.open(`/pos/receipt/${out.id}`, "_blank");

    clear();
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xl font-semibold">PharmaPulse POS (India)</div>
          <div className="text-sm text-slate-600">{status}</div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => clear()} disabled={!items.length}>Clear</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <div className="flex-1">
                <div className="text-sm font-medium">Search / Add (name / code)</div>
                <div className="mt-1 flex gap-2">
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type drug name / internal code, press Add" />
                  <Button onClick={onSearchAdd}>Add</Button>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Tip: Use a USB barcode scanner — just scan; it auto-adds to cart.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-slate-600">Seller state code</div>
                  <Input value={sellerStateCode} onChange={(e) => setSellerStateCode(e.target.value)} placeholder="e.g., 27" />
                </div>
                <div>
                  <div className="text-xs text-slate-600">Buyer state code</div>
                  <Input value={buyerStateCode} onChange={(e) => setBuyerStateCode(e.target.value)} placeholder="e.g., 27" />
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-slate-600">Buyer GSTIN (optional)</div>
                  <Input value={buyerGstin} onChange={(e) => setBuyerGstin(e.target.value)} placeholder="GSTIN for B2B invoices" />
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600 border-b">
                    <th className="py-2">Item</th>
                    <th className="py-2">HSN</th>
                    <th className="py-2">GST%</th>
                    <th className="py-2">Qty</th>
                    <th className="py-2">Price</th>
                    <th className="py-2">Discount</th>
                    <th className="py-2">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((x) => (
                    <tr key={x.id} className="border-b">
                      <td className="py-2">
                        <div className="font-medium">{x.name}</div>
                        <div className="text-xs text-slate-500">{x.barcode ?? x.id}</div>
                      </td>
                      <td className="py-2">{x.hsn ?? "-"}</td>
                      <td className="py-2">{x.gstRate ?? 0}</td>
                      <td className="py-2">
                        <Input
                          className="w-20"
                          value={x.qty}
                          type="number"
                          min={1}
                          onChange={(e) => setQty(x.id, Number(e.target.value))}
                        />
                      </td>
                      <td className="py-2">
                        <Input
                          className="w-28"
                          value={x.unitPrice}
                          type="number"
                          min={0}
                          onChange={(e) => setPrice(x.id, Number(e.target.value))}
                        />
                      </td>
                      <td className="py-2">
                        <Input
                          className="w-28"
                          value={x.discount}
                          type="number"
                          min={0}
                          onChange={(e) => setDiscount(x.id, Number(e.target.value))}
                        />
                      </td>
                      <td className="py-2">
                        <Button variant="destructive" size="sm" onClick={() => remove(x.id)}>X</Button>
                      </td>
                    </tr>
                  ))}
                  {!items.length && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Scan barcode or use Search/Add to start.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-medium">Totals</div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Taxable (Subtotal)</span>
              <span>₹{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">GST Total</span>
              <span>₹{totals.taxTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Grand Total</span>
              <span>₹{totals.grandTotal.toFixed(2)}</span>
            </div>

            <div className="pt-2 border-t space-y-2">
              <div className="text-xs text-slate-600">GST breakup (by HSN & rate)</div>
              <div className="max-h-44 overflow-auto text-xs">
                {totals.buckets.map((b, i) => (
                  <div key={i} className="py-1 border-b">
                    <div className="flex justify-between">
                      <span>HSN {b.hsn ?? "-"}</span>
                      <span>{b.gstRate}%</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Taxable ₹{b.taxableValue.toFixed(2)}</span>
                      <span>
                        {b.igst > 0 ? `IGST ₹${b.igst.toFixed(2)}` : `CGST ₹${b.cgst.toFixed(2)} + SGST ₹${b.sgst.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <Button className="w-full" onClick={() => checkout("CASH")} disabled={!items.length}>Pay Cash</Button>
              <Button className="w-full" variant="secondary" onClick={() => checkout("UPI")} disabled={!items.length}>Pay UPI</Button>
              <Button className="w-full" variant="outline" onClick={() => checkout("CARD")} disabled={!items.length}>Pay Card</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
