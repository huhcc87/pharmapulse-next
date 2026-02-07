import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bucketTaxes } from "@/lib/gst";

function asNum(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(req: Request) {
  const body = await req.json();

  const sellerStateCode = String(body.sellerStateCode || "").trim();
  const buyerStateCode = String(body.buyerStateCode || "").trim();
  const buyerGstin = body.buyerGstin ? String(body.buyerGstin).trim() : null;

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return NextResponse.json({ error: "empty cart" }, { status: 400 });

  if (!sellerStateCode || !buyerStateCode) {
    return NextResponse.json({ error: "state codes required" }, { status: 400 });
  }

  const lines = items.map((x: any) => ({
    hsn: x.hsn ?? null,
    qty: Math.max(1, Math.floor(asNum(x.qty))),
    unitPrice: Math.max(0, asNum(x.unitPrice)),
    discount: Math.max(0, asNum(x.discount)),
    gstRate: x.gstRate == null ? 0 : asNum(x.gstRate),
    taxInclusion: (x.gstType || x.taxInclusion) === "INCLUSIVE" ? "INCLUSIVE" : "EXCLUSIVE",
  }));

  const totals = bucketTaxes(lines, { sellerStateCode, buyerStateCode });

  // Simple invoice number generator: INV-YYYYMMDD-XXXX
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

  const countToday = await prisma.invoice.count({
    where: { invoiceNumber: { startsWith: `INV-${ymd}-` } },
  });
  const seq = String(countToday + 1).padStart(4, "0");
  const invoiceNo = `INV-${ymd}-${seq}`;

  const inter = sellerStateCode !== buyerStateCode;

  // Persist invoice + lines + taxLines + payment
  // Note: This patch file may need updates to match current schema requirements
  const created = await prisma.invoice.create({
    data: {
      tenantId: 1, // TODO: Get from session/context
      sellerOrgId: 1, // TODO: Get from session/context
      sellerGstinId: 1, // TODO: Get from session/context
      invoiceNumber: invoiceNo,
      status: "ISSUED",
      invoiceType: buyerGstin ? "B2B" : "B2C",
      paymentStatus: "PAID",
      placeOfSupply: buyerStateCode,
      buyerGstin: buyerGstin || null,
      totalTaxablePaise: Math.round(totals.subtotal * 100),
      totalGstPaise: Math.round(totals.taxTotal * 100),
      roundOffPaise: 0,
      totalInvoicePaise: Math.round(totals.grandTotal * 100),
      paidAmountPaise: Math.round(totals.grandTotal * 100),
      paymentMethod: body.payment?.method || "CASH",

      lineItems: {
        create: items.map((x: any) => ({
          productId: x.id || null,
          productName: String(x.name || "Item"),
          hsnCode: x.hsn ?? null,
          quantity: Math.max(1, Math.floor(asNum(x.qty))),
          unitPricePaise: Math.round(asNum(x.unitPrice) * 100),
          discountPaise: Math.round(asNum(x.discount) * 100),
          gstRateBps: x.gstRate == null ? 0 : Math.round(asNum(x.gstRate) * 100),
          taxablePaise: 0, // Will be computed below
          cgstPaise: 0,
          sgstPaise: 0,
          igstPaise: 0,
        })),
      },
      taxLines: {
        create: (() => {
          const taxLines: any[] = [];
          totals.buckets.forEach((b) => {
            const rateBps = Math.round(b.gstRate * 100);
            if (b.cgst > 0) {
              taxLines.push({
                taxType: "CGST",
                taxRateBps: rateBps,
                taxPaise: Math.round(b.cgst * 100),
              });
            }
            if (b.sgst > 0) {
              taxLines.push({
                taxType: "SGST",
                taxRateBps: rateBps,
                taxPaise: Math.round(b.sgst * 100),
              });
            }
            if (b.igst > 0) {
              taxLines.push({
                taxType: "IGST",
                taxRateBps: rateBps,
                taxPaise: Math.round(b.igst * 100),
              });
            }
          });
          return taxLines;
        })(),
      },
    },
    select: { id: true, invoiceNumber: true },
  });

  // IMPORTANT: For correctness, compute and store per-line totals server-side.
  // We update taxablePaise/tax amounts here with the exact same gst calculator.
  const persistedLines = await prisma.invoiceLineItem.findMany({
    where: { invoiceId: created.id },
    orderBy: { createdAt: "asc" },
  });

  // Align persisted lines with input lines by index (safe if we created in the same order)
  const updates = persistedLines.map((pl, i) => {
    const l = lines[i];
    const gross = l.qty * l.unitPrice - l.discount;
    const rate = (l.gstRate ?? 0) / 100;

    let taxable = gross;
    let tax = taxable * rate;
    if (l.gstRate > 0 && l.taxInclusion === "INCLUSIVE") { // taxInclusion is from mapped lines, not from DB
      taxable = gross / (1 + rate);
      tax = gross - taxable;
    }

    // Calculate CGST/SGST/IGST based on inter-state status
    const cgst = inter ? 0 : tax / 2;
    const sgst = inter ? 0 : tax / 2;
    const igst = inter ? tax : 0;

    return prisma.invoiceLineItem.update({
      where: { id: pl.id },
      data: {
        taxablePaise: Math.round(taxable * 100),
        cgstPaise: Math.round(cgst * 100),
        sgstPaise: Math.round(sgst * 100),
        igstPaise: Math.round(igst * 100),
      },
    });
  });

  await Promise.all(updates);

  return NextResponse.json({ id: created.id, invoiceNo: created.invoiceNumber });
}
