import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeInvoice } from "@/lib/gst/computeInvoice";
import { assertValidGstStateCode } from "@/lib/validateGst";
import { gstStateFromGstin } from "@/lib/gstStateCodes";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const params = await ctx.params;
    const id = Number(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
    }
    
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { 
        lineItems: true, 
        taxLines: true, 
        sellerGstin: {
          include: {
            org: true,
          },
        },
      },
    }) as any;

    if (!invoice) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Ensure lineItems is always an array
    if (!invoice.lineItems) {
      invoice.lineItems = [];
    }

    // Ensure invoiceType is set (default to B2C if missing)
    if (!invoice.invoiceType) {
      invoice.invoiceType = invoice.buyerGstin && invoice.buyerGstin.length >= 10 ? "B2B" : "B2C";
    }

    // Ensure placeOfSupply defaults to "01" (Jammu & Kashmir) if missing
    if (!invoice.placeOfSupply) {
      invoice.placeOfSupply = "01";
    }

    return NextResponse.json({ invoice });
  } catch (error: any) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const params = await ctx.params;
    const id = Number(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
    }

    const body = await req.json();
    
    // Get existing invoice to check seller GSTIN
    const existing = await prisma.invoice.findUnique({
      where: { id },
      include: { sellerGstin: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Determine intra-state based on place of supply
    const sellerGstin = (existing as any).sellerGstin;
    let placeOfSupply = body.placeOfSupply || existing.placeOfSupply;
    
    // Default to seller state for B2C if empty, otherwise default to "01"
    const invoiceType = body.invoiceType || (existing.buyerGstin && existing.buyerGstin.length >= 10 ? "B2B" : "B2C");
    if (!placeOfSupply) {
      if (invoiceType === "B2C" && sellerGstin?.gstin) {
        placeOfSupply = gstStateFromGstin(sellerGstin.gstin) || sellerGstin.stateCode;
      } else {
        placeOfSupply = "01"; // Default to Jammu & Kashmir
      }
    }
    
    // Validate place of supply
    try {
      assertValidGstStateCode(placeOfSupply);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    const intraState = placeOfSupply
      ? placeOfSupply === sellerGstin?.stateCode
      : true;

    // Normalize line items
    const lineItems = Array.isArray(body.lineItems) ? body.lineItems : (existing as any).lineItems || [];
    const DEFAULT_GST_BPS = 1200; // 12% default GST for medicines
    const DEFAULT_HSN = "3004"; // Default HSN for medicines
    
    // Import HSN lookup
    const { getHsnFromDrugLibrary } = await import("@/lib/gst/hsnLookup");
    
    const normalized = await Promise.all(
      lineItems.map(async (it: any) => {
        const gstRateBps = Number(it.gstRateBps ?? 0);
        // Use default 12% GST if GST rate is 0 or missing
        const finalGstRateBps = gstRateBps > 0 ? gstRateBps : DEFAULT_GST_BPS;
        
        // Auto-fetch HSN if drugLibraryId is present and HSN is missing
        let hsnCode = it.hsnCode || null;
        if (!hsnCode && it.drugLibraryId) {
          try {
            const hsnSuggestion = await getHsnFromDrugLibrary(Number(it.drugLibraryId), prisma);
            if (hsnSuggestion) {
              hsnCode = hsnSuggestion.hsnCode;
            }
          } catch (e) {
            console.error("Failed to fetch HSN:", e);
          }
        }
        
        // Use default HSN if still missing
        if (!hsnCode) {
          hsnCode = DEFAULT_HSN;
        }
        
        return {
          productName: String(it.productName ?? "Item"),
          quantity: Number(it.quantity ?? 1),
          unitPricePaise: Number(it.unitPricePaise ?? 0),
          gstRateBps: finalGstRateBps,
          hsnCode,
          drugLibraryId: it.drugLibraryId || null,
        };
      })
    );

    // Recalculate GST
    const computed = computeInvoice(normalized, intraState);

    // Delete existing line items and tax lines
    await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
    await prisma.taxLine.deleteMany({ where: { invoiceId: id } });

    // Update invoice with recalculated totals
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        buyerName: body.buyerName ?? existing.buyerName,
        buyerGstin: body.buyerGstin ?? existing.buyerGstin,
        invoiceType: invoiceType ?? existing.invoiceType,
        placeOfSupply: placeOfSupply,
        totalTaxablePaise: computed.totalTaxablePaise,
        totalGstPaise: computed.totalGstPaise,
        totalInvoicePaise: computed.totalInvoicePaise,
        lineItems: {
          create: computed.lines.map((l, idx) => ({
            productName: l.productName,
            quantity: l.quantity,
            unitPricePaise: l.unitPricePaise,
            taxablePaise: l.taxablePaise,
            gstRateBps: l.gstRateBps,
            cgstPaise: l.cgstPaise,
            sgstPaise: l.sgstPaise,
            igstPaise: l.igstPaise,
            hsnCode: normalized[idx]?.hsnCode || "3004",
            drugLibraryId: normalized[idx]?.drugLibraryId || null,
          })),
        },
        taxLines: {
          create: buildTaxLines(computed.lines),
        },
      },
      include: {
        lineItems: true,
        taxLines: true,
        sellerGstin: {
          include: {
            org: true,
          },
        },
      },
    });

    // Return proper JSON response
    return NextResponse.json({ 
      invoice: {
        id: updated.id,
        invoiceNumber: updated.invoiceNumber,
        invoiceType: updated.invoiceType,
        status: updated.status,
        placeOfSupply: updated.placeOfSupply,
        buyerName: updated.buyerName,
        buyerGstin: updated.buyerGstin,
        totalTaxablePaise: updated.totalTaxablePaise,
        totalGstPaise: updated.totalGstPaise,
        totalInvoicePaise: updated.totalInvoicePaise,
        lineItems: updated.lineItems,
      }
    });
  } catch (error: any) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update invoice" },
      { status: 500 }
    );
  }
}

function buildTaxLines(lines: any[]) {
  let cgst = 0,
    sgst = 0,
    igst = 0;

  for (const l of lines) {
    cgst += l.cgstPaise ?? 0;
    sgst += l.sgstPaise ?? 0;
    igst += l.igstPaise ?? 0;
  }

  const out: any[] = [];
  if (cgst > 0) out.push({ taxType: "CGST", taxRateBps: 0, taxPaise: cgst });
  if (sgst > 0) out.push({ taxType: "SGST", taxRateBps: 0, taxPaise: sgst });
  if (igst > 0) out.push({ taxType: "IGST", taxRateBps: 0, taxPaise: igst });
  return out;
}
