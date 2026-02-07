"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  labelName?: string | null;
  internalCode?: string | null;
  barcode?: string | null;
  barcodeType?: string | null;
  mrp?: number | null;
  hsn?: string | null;
  gstRate?: number | null;
};

export default function LabelsPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    try {
      const res = await fetch(`/api/pos/search?q=${encodeURIComponent(q)}&take=30`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(search, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function add(p: Product) {
    setSelected((prev) => {
      if (prev.some((x) => x.id === p.id)) return prev;
      return [...prev, p];
    });
  }

  function remove(id: string) {
    setSelected((prev) => prev.filter((x) => x.id !== id));
  }

  const printable = useMemo(() => selected, [selected]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Labels & Barcodes</h1>
          <p className="text-sm text-slate-600">
            Select items → print labels. Internal labels use Code128 (NMED code). Manufacturer barcodes use EAN/UPC if present.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          disabled={printable.length === 0}
          className="px-4 py-2 rounded-md bg-slate-900 text-white disabled:opacity-50"
        >
          Print
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
        <div className="border rounded-lg p-4">
          <div className="text-sm font-medium mb-2">Search products</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name / internal code / barcode..."
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
          {loading && <div className="text-xs text-slate-500 mt-2">Searching…</div>}

          <div className="mt-3 space-y-2">
            {results.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 border rounded-md p-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.labelName || p.name}</div>
                  <div className="text-xs text-slate-600">
                    {p.internalCode ? `Code: ${p.internalCode}` : "No internal code"}{" "}
                    {p.barcode ? `• Barcode: ${p.barcode}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => add(p)}
                  className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="text-sm font-medium mb-2">Selected for printing ({selected.length})</div>
          <div className="space-y-2">
            {selected.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 border rounded-md p-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.labelName || p.name}</div>
                  <div className="text-xs text-slate-600">
                    {p.internalCode ? `Code: ${p.internalCode}` : "No internal code"}{" "}
                    {p.mrp ? `• MRP ₹${p.mrp}` : ""} {p.hsn ? `• HSN ${p.hsn}` : ""}{" "}
                    {p.gstRate != null ? `• GST ${p.gstRate}%` : ""}
                  </div>
                </div>
                <button
                  onClick={() => remove(p.id)}
                  className="px-3 py-1.5 rounded-md bg-slate-200 text-slate-900 text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
            {selected.length === 0 && (
              <div className="text-sm text-slate-500">No items selected.</div>
            )}
          </div>
        </div>
      </div>

      {/* PRINT AREA */}
      <div className="mt-8 print:mt-0">
        <div className="hidden print:block mb-2 text-xs text-slate-600">
          PharmaPulse Labels
        </div>

        {/* A4 label grid: 3 columns x N rows */}
        <div className="grid grid-cols-3 gap-2">
          {printable.map((p) => {
            const internal = p.internalCode || "";
            const internalBarcodeUrl = internal
              ? `/api/barcode?text=${encodeURIComponent(internal)}&type=code128&scale=3`
              : "";

            const mfgBarcode = p.barcode || "";
            const mfgType = (p.barcodeType || "ean13").toLowerCase();
            const mfgBarcodeUrl = mfgBarcode
              ? `/api/barcode?text=${encodeURIComponent(mfgBarcode)}&type=${encodeURIComponent(mfgType)}&scale=3`
              : "";

            return (
              <div
                key={p.id}
                className="border rounded-md p-2 text-[10px] leading-tight break-words"
                style={{ pageBreakInside: "avoid" }}
              >
                <div className="font-semibold text-[11px]">{p.labelName || p.name}</div>
                <div className="text-slate-600">
                  {p.mrp ? `MRP ₹${p.mrp}` : ""} {p.hsn ? `• HSN ${p.hsn}` : ""}{" "}
                  {p.gstRate != null ? `• GST ${p.gstRate}%` : ""}
                </div>

                {/* Internal barcode (recommended for your NMED system) */}
                {internalBarcodeUrl && (
                  <div className="mt-2">
                    <div className="text-[9px] text-slate-600">Internal: {internal}</div>
                    <img src={internalBarcodeUrl} alt="internal barcode" />
                  </div>
                )}

                {/* Manufacturer barcode (optional) */}
                {mfgBarcodeUrl && (
                  <div className="mt-2">
                    <div className="text-[9px] text-slate-600">
                      Pack: {mfgBarcode} ({(p.barcodeType || "EAN13").toUpperCase()})
                    </div>
                    <img src={mfgBarcodeUrl} alt="pack barcode" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Print CSS */}
      <style jsx global>{`
        @media print {
          input, button { display: none !important; }
          .print\\:hidden { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
