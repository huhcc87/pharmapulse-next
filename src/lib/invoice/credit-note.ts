// Credit Note Generation with GST Reversal
// Creates credit note from return/exchange with proper GST reversal

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface CreditNoteInput {
  invoiceId: number;
  returnItems: Array<{
    invoiceLineItemId: number;
    quantity: number; // Quantity to return (must be <= original quantity)
    reason: string; // DAMAGED, EXPIRED, WRONG_ITEM, CUSTOMER_REQUEST, etc.
    remarks?: string;
  }>;
  reason: string;
  remarks?: string;
}

export interface CreditNoteResult {
  success: boolean;
  creditNoteId?: number;
  creditNoteNumber?: string;
  creditAmountPaise?: number;
  cgstPaise?: number;
  sgstPaise?: number;
  igstPaise?: number;
  error?: string;
}

/**
 * Generate Credit Note from invoice return
 * 
 * Features:
 * - GST reversal (CGST/SGST/IGST)
 * - Links to original invoice
 * - Credit note number generation
 * - Audit trail
 */
export async function generateCreditNote(
  input: CreditNoteInput
): Promise<CreditNoteResult> {
  try {
    // Fetch original invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: input.invoiceId },
      include: {
        lineItems: true,
        sellerGstin: true,
      },
    });

    if (!invoice) {
      return {
        success: false,
        error: "Original invoice not found",
      };
    }

    if (invoice.status === "CANCELLED") {
      return {
        success: false,
        error: "Cannot create credit note for cancelled invoice",
      };
    }

    // Validate return items
    for (const returnItem of input.returnItems) {
      const lineItem = invoice.lineItems.find(
        (item) => item.id === returnItem.invoiceLineItemId
      );

      if (!lineItem) {
        return {
          success: false,
          error: `Line item ${returnItem.invoiceLineItemId} not found in invoice`,
        };
      }

      if (returnItem.quantity > lineItem.quantity) {
        return {
          success: false,
          error: `Return quantity (${returnItem.quantity}) exceeds original quantity (${lineItem.quantity})`,
        };
      }
    }

    // Calculate credit note amounts with GST reversal
    let totalCreditPaise = 0;
    let totalCGSTPaise = 0;
    let totalSGSTPaise = 0;
    let totalIGSTPaise = 0;
    let totalTaxablePaise = 0;

    const creditNoteLineItems: Array<{
      originalLineItemId: number;
      productName: string;
      hsnCode: string | null;
      quantity: number;
      unitPricePaise: number;
      taxablePaise: number;
      cgstPaise: number;
      sgstPaise: number;
      igstPaise: number;
      lineTotalPaise: number;
      reason: string;
      remarks?: string;
    }> = [];

    for (const returnItem of input.returnItems) {
      const lineItem = invoice.lineItems.find(
        (item) => item.id === returnItem.invoiceLineItemId
      )!;

      // Calculate proportional amounts
      const returnRatio = returnItem.quantity / lineItem.quantity;
      const returnTaxablePaise = Math.round(lineItem.taxablePaise * returnRatio);
      const returnCGSTPaise = Math.round(lineItem.cgstPaise * returnRatio);
      const returnSGSTPaise = Math.round(lineItem.sgstPaise * returnRatio);
      const returnIGSTPaise = Math.round(lineItem.igstPaise * returnRatio);
      const returnLineTotalPaise = Math.round(lineItem.lineTotalPaise * returnRatio);

      totalTaxablePaise += returnTaxablePaise;
      totalCGSTPaise += returnCGSTPaise;
      totalSGSTPaise += returnSGSTPaise;
      totalIGSTPaise += returnIGSTPaise;
      totalCreditPaise += returnLineTotalPaise;

      creditNoteLineItems.push({
        originalLineItemId: lineItem.id,
        productName: lineItem.productName,
        hsnCode: lineItem.hsnCode,
        quantity: returnItem.quantity,
        unitPricePaise: lineItem.unitPricePaise,
        taxablePaise: returnTaxablePaise,
        cgstPaise: returnCGSTPaise,
        sgstPaise: returnSGSTPaise,
        igstPaise: returnIGSTPaise,
        lineTotalPaise: returnLineTotalPaise,
        reason: returnItem.reason,
        remarks: returnItem.remarks,
      });
    }

    // Generate credit note number
    const creditNoteNumber = await generateCreditNoteNumber(invoice.sellerGstinId);

    // Create credit note
    const creditNote = await prisma.creditNote.create({
      data: {
        creditNoteNumber,
        invoiceId: invoice.id,
        tenantId: invoice.tenantId,
        sellerOrgId: invoice.sellerOrgId,
        sellerGstinId: invoice.sellerGstinId,
        customerId: invoice.customerId,
        reason: input.reason,
        remarks: input.remarks,
        creditNoteDate: new Date(),
        status: "ISSUED",
        totalCreditPaise: totalCreditPaise,
        totalTaxablePaise: totalTaxablePaise,
        totalCGSTPaise: totalCGSTPaise,
        totalSGSTPaise: totalSGSTPaise,
        totalIGSTPaise: totalIGSTPaise,
        supplyType: invoice.supplyType,
        placeOfSupplyStateCode: invoice.placeOfSupplyStateCode,
        lineItems: {
          create: creditNoteLineItems.map((item) => ({
            originalLineItemId: item.originalLineItemId,
            productName: item.productName,
            hsnCode: item.hsnCode,
            quantity: item.quantity,
            unitPricePaise: item.unitPricePaise,
            taxablePaise: item.taxablePaise,
            cgstPaise: item.cgstPaise,
            sgstPaise: item.sgstPaise,
            igstPaise: item.igstPaise,
            lineTotalPaise: item.lineTotalPaise,
            reason: item.reason,
            remarks: item.remarks,
          })),
        },
      },
      include: {
        lineItems: true,
      },
    });

    return {
      success: true,
      creditNoteId: creditNote.id,
      creditNoteNumber: creditNote.creditNoteNumber,
      creditAmountPaise: creditNote.totalCreditPaise,
      cgstPaise: creditNote.totalCGSTPaise,
      sgstPaise: creditNote.totalSGSTPaise,
      igstPaise: creditNote.totalIGSTPaise,
    };
  } catch (error: any) {
    console.error("Credit note generation error:", error);
    return {
      success: false,
      error: error.message || "Credit note generation failed",
    };
  }
}

/**
 * Generate credit note number
 * Format: CN/YYYY-MM/0001
 */
async function generateCreditNoteNumber(sellerGstinId: number): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `CN/${year}-${month}`;

  // Find last credit note for this month
  const lastCreditNote = await prisma.creditNote.findFirst({
    where: {
      sellerGstinId,
      creditNoteNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      creditNoteNumber: "desc",
    },
  });

  let nextNumber = 1;
  if (lastCreditNote) {
    const lastNumber = parseInt(lastCreditNote.creditNoteNumber.split("/")[2] || "0");
    nextNumber = lastNumber + 1;
  }

  return `${prefix}/${String(nextNumber).padStart(4, "0")}`;
}
