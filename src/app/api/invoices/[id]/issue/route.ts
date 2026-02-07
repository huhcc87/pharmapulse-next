// src/app/api/invoices/[id]/issue/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { allocateInvoiceNumber } from "@/lib/gst/invoiceNumber";
import { computeInvoice } from "@/lib/gst/computeInvoice";
import { assertValidGstStateCode } from "@/lib/validateGst";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/invoices/:id/issue
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const resolvedParams = await params;
    const existing = await prisma.invoice.findUnique({
      where: { id: parseInt(resolvedParams.id) },
      include: { sellerGstin: true, lineItems: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (existing.status !== "DRAFT") {
      return NextResponse.json({ error: "Only DRAFT invoices can be issued" }, { status: 400 });
    }

    if (!existing.placeOfSupply) {
      return NextResponse.json({ error: "Place of supply is required before issuing" }, { status: 400 });
    }
    
    // Validate place of supply
    try {
      assertValidGstStateCode(existing.placeOfSupply);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Recompute to ensure totals/taxes are correct
    const intraState = existing.placeOfSupply === existing.sellerGstin?.stateCode;
    const computed = computeInvoice(
      existing.lineItems.map((li) => ({
        productName: li.productName,
        quantity: li.quantity,
        unitPricePaise: li.unitPricePaise,
        gstRateBps: li.gstRateBps,
      })),
      intraState
    );

    const invoiceNumber = await allocateInvoiceNumber(existing.sellerGstinId, prisma);

    const updated = await prisma.$transaction(async (tx) => {
      // Replace line items with computed values (ensures consistent totals)
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId: existing.id } });

      const inv = await tx.invoice.update({
        where: { id: existing.id },
        data: {
          invoiceNumber,
          status: "ISSUED",
          invoiceDate: new Date(),
          totalTaxablePaise: computed.totalTaxablePaise,
          totalGstPaise: computed.totalGstPaise,
          totalInvoicePaise: computed.totalInvoicePaise,
          lineItems: {
            create: existing.lineItems.map((orig, idx) => ({
              productId: orig.productId,
              drugLibraryId: orig.drugLibraryId,
              productName: orig.productName,
              hsnCode: orig.hsnCode,
              batchNumber: orig.batchNumber,
              expiryDate: orig.expiryDate,
              quantity: orig.quantity,
              unitPricePaise: orig.unitPricePaise,
              taxablePaise: computed.lines[idx]?.taxablePaise ?? orig.taxablePaise,
              gstRateBps: orig.gstRateBps,
              cgstPaise: computed.lines[idx]?.cgstPaise ?? orig.cgstPaise,
              sgstPaise: computed.lines[idx]?.sgstPaise ?? orig.sgstPaise,
              igstPaise: computed.lines[idx]?.igstPaise ?? orig.igstPaise,
            })),
          },
        },
        include: { lineItems: true },
      });

      return inv;
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    console.error("POST /api/invoices/[id]/issue error", e);
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
