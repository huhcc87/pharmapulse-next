import JSZip from "jszip";
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export async function POST(req: Request) {
  const { gstinId, period } = await req.json();

  const invoices = await prisma.invoice.findMany({
    where: {
      sellerGstinId: gstinId,
      status: { in: ["ISSUED", "FILED"] },
      // you can filter by invoiceDate month == period
    },
  });

  const zip = new JSZip();

  // 1) CSV
  const rows = [
    ["invoiceNumber","date","type","taxable","cgst","sgst","igst","total"].join(","),
    ...invoices.map(i => [
      i.invoiceNumber,
      i.invoiceDate.toISOString().slice(0,10),
      i.invoiceType,
      i.totalTaxablePaise/100,
      0,0,0, // if you store split totals; else compute from taxLines
      i.totalInvoicePaise/100
    ].join(","))
  ];
  zip.file(`summary_${period}.csv`, rows.join("\n"));

  // 2) PDFs (if you store pdfUrl)
  for (const inv of invoices) {
    if (!inv.pdfUrl) continue;
    // fetch bytes (server-side fetch works for public URLs)
    const res = await fetch(inv.pdfUrl);
    if (!res.ok) continue;
    const buf = await res.arrayBuffer();
    zip.file(`pdf/${inv.invoiceNumber}.pdf`, buf);
  }

  const content = await zip.generateAsync({ type: "uint8array" });

  return new NextResponse(content as any, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="CA_export_${period}.zip"`,
    },
  });
}
