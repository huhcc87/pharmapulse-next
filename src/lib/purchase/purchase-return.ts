// Purchase Return Management
// Handles purchase returns with GST reversal

import { prisma } from "@/lib/prisma";

export interface PurchaseReturnInput {
  grnId?: number;
  purchaseOrderId?: number;
  vendorId: number;
  returnItems: Array<{
    productId?: number;
    drugLibraryId?: number;
    productName: string;
    quantity: number;
    batchCode?: string;
    reason: string; // DAMAGED, EXPIRED, WRONG_ITEM, QUALITY_ISSUE
  }>;
  reason: string;
  notes?: string;
}

export interface PurchaseReturnResult {
  success: boolean;
  returnId?: number;
  returnNumber?: string;
  error?: string;
}

/**
 * Create purchase return note
 */
export async function createPurchaseReturn(
  input: PurchaseReturnInput,
  tenantId: number = 1
): Promise<PurchaseReturnResult> {
  try {
    // Validate vendor
    const vendor = await prisma.vendor.findUnique({
      where: { id: input.vendorId },
    });

    if (!vendor) {
      return {
        success: false,
        error: "Vendor not found",
      };
    }

    // Validate GRN or PO if provided
    if (input.grnId) {
      const grn = await prisma.gRN.findUnique({
        where: { id: input.grnId },
        include: { lineItems: true },
      });

      if (!grn) {
        return {
          success: false,
          error: "GRN not found",
        };
      }
    }

    if (input.purchaseOrderId) {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: input.purchaseOrderId },
        include: { lineItems: true },
      });

      if (!po) {
        return {
          success: false,
          error: "Purchase order not found",
        };
      }
    }

    // Generate return number
    const returnNumber = await generatePurchaseReturnNumber(tenantId);

    // Calculate return amounts (simplified - would need actual purchase prices from GRN/PO)
    let totalAmountPaise = 0;
    let totalCGSTPaise = 0;
    let totalSGSTPaise = 0;
    let totalIGSTPaise = 0;

    // For now, calculate from return items (in production, get prices from GRN/PO)
    for (const item of input.returnItems) {
      // Estimate price (should come from GRN/PO in production)
      const estimatedPricePaise = 0; // Would fetch from GRN/PO
      totalAmountPaise += estimatedPricePaise * item.quantity;
    }

    // Create purchase return
    const purchaseReturn = await prisma.purchaseReturn.create({
      data: {
        returnNumber,
        purchaseOrderId: input.purchaseOrderId || null,
        grnId: input.grnId || null,
        vendorId: input.vendorId,
        tenantId,
        returnDate: new Date(),
        reason: input.reason,
        status: "PENDING",
        totalAmountPaise,
        cgstPaise: totalCGSTPaise,
        sgstPaise: totalSGSTPaise,
        igstPaise: totalIGSTPaise,
        notes: input.notes || null,
        lineItems: {
          create: input.returnItems.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
            batchCode: item.batchCode || null,
            reason: item.reason,
            amountPaise: 0, // Would calculate from GRN/PO in production
          })),
        },
      },
      include: {
        lineItems: true,
      },
    });

    return {
      success: true,
      returnId: purchaseReturn.id,
      returnNumber: purchaseReturn.returnNumber,
    };
  } catch (error: any) {
    console.error("Purchase return creation error:", error);
    return {
      success: false,
      error: error.message || "Purchase return creation failed",
    };
  }
}

/**
 * Generate purchase return number
 * Format: PR/YYYY-MM/0001
 */
async function generatePurchaseReturnNumber(tenantId: number): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `PR/${year}-${month}`;

  const lastReturn = await prisma.purchaseReturn.findFirst({
    where: {
      tenantId,
      returnNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      returnNumber: "desc",
    },
  });

  let nextNumber = 1;
  if (lastReturn) {
    const lastNumber = parseInt(lastReturn.returnNumber.split("/")[2] || "0");
    nextNumber = lastNumber + 1;
  }

  return `${prefix}/${String(nextNumber).padStart(4, "0")}`;
}
