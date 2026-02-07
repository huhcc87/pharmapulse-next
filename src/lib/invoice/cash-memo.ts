// Cash Memo Generation for Small Sales (<₹200)
// Non-GST invoice for small B2C transactions

import { prisma } from "@/lib/prisma";

export interface CashMemoInput {
  lineItems: Array<{
    productName: string;
    quantity: number;
    unitPricePaise: number;
    discountPaise?: number;
  }>;
  customerName?: string;
  customerPhone?: string;
  tenantId?: number;
  sellerGstinId: number;
}

export interface CashMemoResult {
  success: boolean;
  cashMemoId?: number;
  cashMemoNumber?: string;
  totalAmountPaise?: number;
  error?: string;
}

/**
 * Generate Cash Memo for small sales (<₹200)
 * 
 * Cash Memo Rules (India):
 * - For B2C sales <₹200
 * - No GST fields required
 * - Simplified invoice format
 * - Cash memo number: CM/YYYY-MM/0001
 */
export async function generateCashMemo(
  input: CashMemoInput
): Promise<CashMemoResult> {
  try {
    const { lineItems, customerName, customerPhone, tenantId = 1, sellerGstinId } = input;

    // Calculate total
    let totalAmountPaise = 0;
    for (const item of lineItems) {
      const lineTotal = (item.unitPricePaise * item.quantity) - (item.discountPaise || 0);
      totalAmountPaise += lineTotal;
    }

    // Check if amount is <₹200 (cash memo threshold)
    const totalAmountRupees = totalAmountPaise / 100;
    if (totalAmountRupees >= 200) {
      return {
        success: false,
        error: "Cash memo only applicable for sales <₹200. Use regular tax invoice for ₹200 and above.",
      };
    }

    // Generate cash memo number
    const cashMemoNumber = await generateCashMemoNumber(sellerGstinId);

    // Fetch seller GSTIN details
    const sellerGstin = await prisma.orgGstin.findUnique({
      where: { id: sellerGstinId },
      include: { org: true },
    });

    if (!sellerGstin) {
      return {
        success: false,
        error: "Seller GSTIN not found",
      };
    }

    // Create cash memo (as Invoice with isCashMemo flag)
    // Note: Schema needs isCashMemo field added
    const cashMemo = await prisma.invoice.create({
      data: {
        tenantId,
        sellerOrgId: sellerGstin.orgId,
        sellerGstinId: sellerGstin.id,
        buyerName: customerName || "Walk-in Customer",
        buyerPhone: customerPhone || null,
        invoiceType: "CASH_MEMO", // Special type for cash memo
        status: "ISSUED",
        invoiceNumber: cashMemoNumber, // Use cash memo number as invoice number
        invoiceDate: new Date(),
        totalTaxablePaise: totalAmountPaise, // No GST, so taxable = total
        totalGstPaise: 0, // No GST for cash memo
        totalCGSTPaise: 0,
        totalSGSTPaise: 0,
        totalIGSTPaise: 0,
        totalInvoicePaise: totalAmountPaise,
        lineItems: {
          create: lineItems.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
            unitPricePaise: item.unitPricePaise,
            discountPaise: item.discountPaise || 0,
            taxablePaise: (item.unitPricePaise * item.quantity) - (item.discountPaise || 0),
            gstRateBps: 0, // No GST
            cgstPaise: 0,
            sgstPaise: 0,
            igstPaise: 0,
            lineTotalPaise: (item.unitPricePaise * item.quantity) - (item.discountPaise || 0),
          })),
        },
      },
      include: {
        lineItems: true,
      },
    });

    return {
      success: true,
      cashMemoId: cashMemo.id,
      cashMemoNumber: cashMemo.invoiceNumber || cashMemoNumber,
      totalAmountPaise: cashMemo.totalInvoicePaise,
    };
  } catch (error: any) {
    console.error("Cash memo generation error:", error);
    return {
      success: false,
      error: error.message || "Cash memo generation failed",
    };
  }
}

/**
 * Generate cash memo number
 * Format: CM/YYYY-MM/0001
 */
async function generateCashMemoNumber(sellerGstinId: number): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `CM/${year}-${month}`;

  // Find last cash memo for this month
  const lastCashMemo = await prisma.invoice.findFirst({
    where: {
      sellerGstinId,
      invoiceType: "CASH_MEMO",
      invoiceNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      invoiceNumber: "desc",
    },
  });

  let nextNumber = 1;
  if (lastCashMemo && lastCashMemo.invoiceNumber) {
    const parts = lastCashMemo.invoiceNumber.split("/");
    if (parts.length === 3) {
      const lastNumber = parseInt(parts[2] || "0");
      nextNumber = lastNumber + 1;
    }
  }

  return `${prefix}/${String(nextNumber).padStart(4, "0")}`;
}
