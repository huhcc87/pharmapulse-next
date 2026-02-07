// Stock Transfer Note (STN) Management
// Handles stock transfers between branches with GST impact

import { prisma } from "@/lib/prisma";

export interface StockTransferInput {
  fromBranchId: number;
  toBranchId: number;
  lineItems: Array<{
    productId?: number;
    drugLibraryId?: number;
    batchId?: number;
    productName: string;
    hsnCode?: string;
    quantity: number;
    batchCode?: string;
  }>;
  notes?: string;
}

export interface StockTransferResult {
  success: boolean;
  stnId?: number;
  stnNumber?: string;
  error?: string;
}

/**
 * Create Stock Transfer Note
 */
export async function createStockTransfer(
  input: StockTransferInput,
  tenantId: number = 1,
  requestedBy?: number
): Promise<StockTransferResult> {
  try {
    // Validate branches (for now, branches are represented by branchId in other models)
    // In a full implementation, you'd have a Branch model
    if (input.fromBranchId === input.toBranchId) {
      return {
        success: false,
        error: "Source and destination branches cannot be the same",
      };
    }

    // Generate STN number
    const stnNumber = await generateSTNNumber(tenantId);

    // Calculate transfer amounts (GST impact if inter-state)
    // For now, simplified calculation
    let totalAmountPaise = 0;
    let totalCGSTPaise = 0;
    let totalSGSTPaise = 0;
    let totalIGSTPaise = 0;

    // Determine if inter-state transfer (would need branch state codes)
    // For now, assume intra-state
    const isInterState = false; // Would determine from branch state codes

    for (const item of input.lineItems) {
      // Get product/batch price (simplified - would fetch actual prices)
      const estimatedPricePaise = 0; // Would fetch from inventory
      totalAmountPaise += estimatedPricePaise * item.quantity;
    }

    // Create STN
    const stockTransfer = await prisma.stockTransferNote.create({
      data: {
        stnNumber,
        tenantId,
        fromBranchId: input.fromBranchId,
        toBranchId: input.toBranchId,
        transferDate: new Date(),
        status: "DRAFT",
        supplyType: isInterState ? "INTER_STATE" : "INTRA_STATE",
        totalAmountPaise,
        totalCGSTPaise,
        totalSGSTPaise,
        totalIGSTPaise,
        requestedBy: requestedBy || null,
        notes: input.notes || null,
        lineItems: {
          create: input.lineItems.map((item) => ({
            productId: item.productId || null,
            drugLibraryId: item.drugLibraryId || null,
            batchId: item.batchId || null,
            productName: item.productName,
            hsnCode: item.hsnCode || null,
            quantity: item.quantity,
            batchCode: item.batchCode || null,
          })),
        },
      },
      include: {
        lineItems: true,
      },
    });

    return {
      success: true,
      stnId: stockTransfer.id,
      stnNumber: stockTransfer.stnNumber,
    };
  } catch (error: any) {
    console.error("Stock transfer creation error:", error);
    return {
      success: false,
      error: error.message || "Stock transfer creation failed",
    };
  }
}

/**
 * Generate STN number
 * Format: STN/YYYY-MM/0001
 */
async function generateSTNNumber(tenantId: number): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `STN/${year}-${month}`;

  const lastSTN = await prisma.stockTransferNote.findFirst({
    where: {
      tenantId,
      stnNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      stnNumber: "desc",
    },
  });

  let nextNumber = 1;
  if (lastSTN) {
    const lastNumber = parseInt(lastSTN.stnNumber.split("/")[2] || "0");
    nextNumber = lastNumber + 1;
  }

  return `${prefix}/${String(nextNumber).padStart(4, "0")}`;
}
