"use client";

import { useMemo, useState, useEffect } from "react";

type Size = "30" | "38" | "40" | "58" | "80";

type LabelItem = {
  name: string;
  code: string;
  type: "EAN8" | "EAN13" | "UPCA";
  qty: number;
};

export default function LabelsPage() {
  const [size, setSize] = useState<Size>("58");
  const [items, setItems] = useState<LabelItem[]>([
    { name: "Vicks NyQuil Cough", code: "0323900014329", type: "EAN13", qty: 1 },
    { name: "Crocin", code: "8901571012060", type: "EAN13", qty: 1 },
    { name: "Dolo 650 mg (Bulk)", code: "40334273", type: "EAN8", qty: 1 },
  ]);
  const [barcodeImages, setBarcodeImages] = useState<Record<string, string>>({});

  // Load barcode SVGs
  useEffect(() => {
    const loadBarcodes = async () => {
      const images: Record<string, string> = {};
      for (const item of items) {
        const url = `/api/barcode?code=${encodeURIComponent(item.code)}&type=${encodeURIComponent(item.type)}`;
        try {
          const res = await fetch(url);
          if (res.ok) {
            const svgText = await res.text();
            images[`${item.code}-${item.type}`] = `data:image/svg+xml;base64,${btoa(svgText)}`;
          }
        } catch (e) {
          console.error(`Failed to load barcode for ${item.code}:`, e);
        }
      }
      setBarcodeImages(images);
    };
    loadBarcodes();
  }, [items]);

  const expanded = useMemo(() => {
    const out: LabelItem[] = [];
    for (const it of items) for (let i = 0; i < it.qty; i++) out.push(it);
    return out;
  }, [items]);

  const labelClass = `label label-${size}`;

  return (
    <div style={{ padding: 16 }}>
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .controls { display: none !important; }
          .sheet { page-break-after: auto; }
          .label { page-break-inside: avoid; }
        }
        .sheet {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .label {
          border: 1px dashed #ccc;
          box-sizing: border-box;
          padding: 2mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .name {
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 2mm;
        }
        .digits {
          font-size: 10px;
          text-align: center;
          margin-top: 2mm;
          letter-spacing: 0.5px;
          font-family: monospace;
        }
        .barcode {
          display: flex;
          justify-content: center;
          align-items: center;
          flex: 1;
        }
        .barcode img {
          max-width: 100%;
          height: auto;
        }

        .label-30 { width: 30mm; min-height: 20mm; font-size: 7px; }
        .label-38 { width: 38mm; min-height: 25mm; font-size: 7px; }
        .label-40 { width: 40mm; min-height: 25mm; font-size: 8px; }
        .label-58 { width: 58mm; min-height: 35mm; font-size: 9px; padding: 3mm; }
        .label-80 { width: 80mm; min-height: 45mm; font-size: 10px; padding: 3mm; }
      `}</style>

      <div
        className="controls"
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <label>
          Label width:
          <select
            value={size}
            onChange={(e) => setSize(e.target.value as Size)}
            style={{ marginLeft: 8, padding: "4px 8px" }}
          >
            <option value="30">30mm</option>
            <option value="38">38mm</option>
            <option value="40">40mm</option>
            <option value="58">58mm</option>
            <option value="80">80mm</option>
          </select>
        </label>
        <button
          onClick={() => window.print()}
          style={{
            padding: "8px 16px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Print
        </button>
        <button
          onClick={() => window.print()}
          style={{
            padding: "8px 16px",
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Print Test Label
        </button>
      </div>

      <div className="sheet">
        {expanded.map((it, idx) => {
          const imageKey = `${it.code}-${it.type}`;
          const imageSrc = barcodeImages[imageKey] || `/api/barcode?code=${encodeURIComponent(it.code)}&type=${encodeURIComponent(it.type)}`;
          return (
            <div key={idx} className={labelClass}>
              <div className="name" title={it.name}>
                {it.name}
              </div>
              <div className="barcode">
                <img src={imageSrc} alt={`${it.type} ${it.code}`} />
              </div>
              <div className="digits">{it.code}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
