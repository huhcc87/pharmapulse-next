import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeInvoice } from "@/lib/gst/computeInvoice";
import { assertValidGstStateCode } from "@/lib/validateGst";
import { gstStateFromGstin } from "@/lib/gstStateCodes";
import { determineSupplyType } from "@/lib/gst/advanced";

// Fix: The POST body structure from POS page

const DEMO_TENANT_ID = 1;

export async function POST(req: Request) {
  try {
    const body = await req.json();

  // Support both formats: body.sellerGstinId or default to first GSTIN
  let sellerGstinId = Number(body.sellerGstinId);
  if (!sellerGstinId || isNaN(sellerGstinId)) {
    // Get first active GSTIN as default
    let defaultGstin = await prisma.orgGstin.findFirst({
      where: { isActive: true },
    });
    
    // If no GSTIN exists, create a default one
    if (!defaultGstin) {
      let org = await prisma.org.findFirst({ where: { tenantId: DEMO_TENANT_ID } });
      if (!org) {
        org = await prisma.org.create({
          data: {
            tenantId: DEMO_TENANT_ID,
            name: "Demo Pharmacy",
            role: "RETAILER",
          },
        });
      }
      
      defaultGstin = await prisma.orgGstin.create({
        data: {
          orgId: org.id,
          gstin: "27AAAAA0000A1Z5",
          stateCode: "27",
          legalName: "Demo Pharmacy",
          isActive: true,
          invoicePrefix: "INV",
          nextInvoiceNo: 1,
        },
      });
    }
    
    sellerGstinId = defaultGstin.id;
  }

  // Customer information
  const buyerName = String(body.buyerName ?? "").trim() || null;
  const buyerGstin = String(body.buyerGstin ?? "").trim() || null;
  const buyerPhone = String(body.buyerPhone ?? "").trim() || null;
  const buyerEmail = String(body.buyerEmail ?? "").trim() || null;
  const buyerAddress = String(body.buyerAddress ?? "").trim() || null;
  const buyerCity = String(body.buyerCity ?? "").trim() || null;
  const buyerState = String(body.buyerState ?? "").trim() || null;
  const buyerPincode = String(body.buyerPincode ?? "").trim() || null;
  
  // Invoice details
  const invoiceDate = body.invoiceDate ? new Date(body.invoiceDate) : new Date();
  const dueDate = body.dueDate ? new Date(body.dueDate) : null;
  const paymentTerms = String(body.paymentTerms ?? "").trim() || null;
  const referenceNumber = String(body.referenceNumber ?? "").trim() || null;
  const notes = String(body.notes ?? "").trim() || null;
  
  // Payment information
  const paymentMethod = String(body.paymentMethod ?? "").trim() || null;
  const paymentReference = String(body.paymentReference ?? "").trim() || null;
  
  // Additional charges and discounts
  const shippingChargesPaise = Number(body.shippingChargesPaise ?? 0);
  const handlingChargesPaise = Number(body.handlingChargesPaise ?? 0);
  const globalDiscountPaise = Number(body.globalDiscountPaise ?? 0);
  const globalDiscountPercent = body.globalDiscountPercent ? Number(body.globalDiscountPercent) : undefined;
  const couponCode = String(body.couponCode ?? "").trim() || null;
  const couponDiscountPaise = Number(body.couponDiscountPaise ?? 0);
  
  // Get seller GSTIN first (before using it)
  const sellerGstin = await prisma.orgGstin.findUnique({
    where: { id: sellerGstinId },
    include: { org: true },
  });
  
  if (!sellerGstin) {
    return NextResponse.json({ error: "GSTIN not found" }, { status: 404 });
  }

  // Get place of supply, default to Jammu & Kashmir (01) or seller state for B2C
  let placeOfSupply = String(body.placeOfSupply ?? "").trim() || null;
  const invoiceType = body.invoiceType || (buyerGstin && buyerGstin.length >= 10 ? "B2B" : "B2C");
  
  // Default to seller state code for B2C if not provided, otherwise default to "01"
  if (!placeOfSupply) {
    if (invoiceType === "B2C" && sellerGstin.gstin) {
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

  // Support both body.items and body.lineItems
  const items = Array.isArray(body.items) ? body.items : (Array.isArray(body.lineItems) ? body.lineItems : []);
  if (items.length === 0) {
    return NextResponse.json({ error: "No items" }, { status: 400 });
  }
  
  // Determine supply type based on seller and buyer/place of supply state codes
  const buyerStateCode = buyerGstin ? gstStateFromGstin(buyerGstin) : placeOfSupply || null;
  const supplyType = determineSupplyType({
    sellerStateCode: sellerGstin.stateCode,
    buyerStateCode: buyerStateCode,
    placeOfSupplyPolicy: (sellerGstin.org.placeOfSupplyPolicy as "CUSTOMER_STATE" | "STORE_STATE" | undefined) || "CUSTOMER_STATE",
  });
  
  const intraState = placeOfSupply
    ? placeOfSupply === sellerGstin.stateCode
    : supplyType === "INTRA_STATE";

  const DEFAULT_GST_BPS = 1200; // 12% default GST for medicines
  const DEFAULT_HSN = "3004"; // Default HSN for medicines
  
  // Import HSN lookup
  const { getHsnFromDrugLibrary } = await import("@/lib/gst/hsnLookup");
  
  const normalized = await Promise.all(
    items.map(async (it: any) => {
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
        unitType: String(it.unitType ?? "PIECE"),
        gstRateBps: finalGstRateBps,
        discountPaise: Number(it.discountPaise ?? 0),
        discountPercent: it.discountPercent ? Number(it.discountPercent) : null,
        hsnCode,
        drugLibraryId: it.drugLibraryId || null,
        productId: it.productId || null,
        batchNumber: it.batchNumber || null,
        expiryDate: it.expiryDate ? new Date(it.expiryDate) : null,
      };
    })
  );

  const charges = {
    shippingChargesPaise,
    handlingChargesPaise,
    globalDiscountPaise,
    globalDiscountPercent,
    couponDiscountPaise,
  };
  
  const computed = computeInvoice(normalized, intraState, charges);

  // Build invoice data - only include fields that exist in schema
  const invoiceData: any = {
      tenantId: DEMO_TENANT_ID,
      sellerOrgId: sellerGstin.orgId,
      sellerGstinId: sellerGstin.id,
      buyerName,
      buyerGstin,
      placeOfSupply,
      placeOfSupplyStateCode: placeOfSupply,
      invoiceType,
      invoiceDate,
      supplyType,
      status: "DRAFT",
      totalTaxablePaise: computed.totalTaxablePaise,
      totalGstPaise: computed.totalGstPaise,
      roundOffPaise: body.roundOffPaise ?? 0,
      totalInvoicePaise: computed.totalInvoicePaise + (body.roundOffPaise ?? 0),
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
          productId: normalized[idx]?.productId || null,
          batchNumber: normalized[idx]?.batchNumber || null,
          expiryDate: normalized[idx]?.expiryDate ? new Date(normalized[idx].expiryDate) : null,
        })),
      },
      taxLines: {
        create: buildTaxLines(computed.lines),
      },
    };

  // Add optional fields only if they exist (to avoid schema errors)
  if (buyerPhone) invoiceData.buyerPhone = buyerPhone;
  if (buyerEmail) invoiceData.buyerEmail = buyerEmail;
  if (buyerAddress) invoiceData.buyerAddress = buyerAddress;
  if (buyerCity) invoiceData.buyerCity = buyerCity;
  if (buyerState) invoiceData.buyerState = buyerState;
  if (buyerPincode) invoiceData.buyerPincode = buyerPincode;
  if (dueDate) invoiceData.dueDate = dueDate;
  if (paymentTerms) invoiceData.paymentTerms = paymentTerms;
  if (referenceNumber) invoiceData.referenceNumber = referenceNumber;
  if (notes) invoiceData.notes = notes;
  if (paymentMethod) invoiceData.paymentMethod = paymentMethod;
  if (paymentReference) invoiceData.paymentReference = paymentReference;
  if (shippingChargesPaise > 0) invoiceData.shippingChargesPaise = shippingChargesPaise;
  if (handlingChargesPaise > 0) invoiceData.handlingChargesPaise = handlingChargesPaise;
  if (globalDiscountPaise > 0) invoiceData.globalDiscountPaise = globalDiscountPaise;
  if (globalDiscountPercent) invoiceData.globalDiscountPercent = globalDiscountPercent;
  if (couponCode) invoiceData.couponCode = couponCode;
  if (couponDiscountPaise > 0) invoiceData.couponDiscountPaise = couponDiscountPaise;

  const created = await prisma.invoice.create({
    data: invoiceData,
    include: { lineItems: true, taxLines: true },
  });

    // Return proper JSON response
    return NextResponse.json(
      { 
        id: created.id, 
        invoice: {
          id: created.id,
          invoiceNumber: created.invoiceNumber,
          invoiceType: created.invoiceType,
          status: created.status,
          totalTaxablePaise: created.totalTaxablePaise,
          totalGstPaise: created.totalGstPaise,
          totalInvoicePaise: created.totalInvoicePaise,
        }
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating invoice:", error);
    // Return detailed error message for debugging
    let errorMessage = "Failed to create invoice";
    
    // Check for specific Prisma errors
    if (error?.code === "P2002") {
      errorMessage = "Duplicate entry. Invoice may already exist.";
    } else if (error?.code === "P2003") {
      errorMessage = "Invalid reference. Please check your data.";
    } else if (error?.code === "P2011") {
      errorMessage = "Null constraint violation. Please fill all required fields.";
    } else if (error?.code === "P2025") {
      errorMessage = "Record not found. Please refresh and try again.";
    } else if (error?.message) {
      errorMessage = error.message;
    }
    
    // Log full error for debugging
    console.error("Full error details:", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    
    return NextResponse.json(
      { 
        error: errorMessage,
        code: error?.code || null,
      },
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
