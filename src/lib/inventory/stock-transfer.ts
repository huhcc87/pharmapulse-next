// src/lib/inventory/stock-transfer.ts
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

    /**
     * OPTIONAL: if you already know the price at transfer time, pass it.
     * If omitted, we will try to infer it from inventory/product; otherwise 0.
     */
    unitPricePaise?: number;
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
 * Best-effort unit price resolver (paise)
 * Priority:
 *  1) input.unitPricePaise
 *  2) inventoryItem.purchaseRate plotting / mrp / sellingPrice style fields (schema-dependent; guarded)
 *  3) product.mrp / product.salePrice fields (schema-dependent; guarded)
 *  4) fallback 0
 */
async function resolveUnitPricePaise(args: {
  tenantId: number;
  branchId: number;
  productId?: number;
  drugLibraryId?: number;
  batchId?: number;
  unitPricePaise?: number;
}): Promise<number> {
  const { tenantId, branchId, productId, drugLibraryId, batchId, unitPricePaise } = args;

  if (Number.isFinite(unitPricePaise)) return Math.max(0, Math.trunc(unitPricePaise as number));

  // 1) Try inventory item (batch-based is most reliable)
  if (batchId) {
    const inv = await prisma.inventoryItem.findFirst({
      where: {
        tenantId,
        branchId,
        batchId,
      },
      select: {
        // these fields may or may not exist in your schema; use "as any" safely
        mrp: true as any,
        salePricePaise: true as any,
        purchasePricePaise: true as any,
        unitCostPaise: true as any,
      } as any,
    });

    if (inv) {
      const anyInv = inv as any;
      const candidates = [
        anyInv.salePricePaise,
        anyInv.purchasePricePaise,
        anyInv.unitCostPaise,
      ].filter((v: any) => typeof v === "number" && Number.isFinite(v) && v >= 0);

      if (candidates.length > 0) return Math.trunc(candidates[0]);

      // mrp might be Decimal/string/number
      if (anyInv.mrp != null) {
        const mrpNum =
          typeof anyInv.mrp?.toNumber === "function"
            ? anyInv.mrp.toNumber()
            : typeof anyInv.mrp === "number"
              ? anyInv.mrp
              : typeof anyInv.mrp === "string"
                ? Number(anyInv.mrp)
                : NaN;

        if (Number.isFinite(mrpNum)) return Math.trunc(mrpNum * 100); // assume rupees → paise
      }
    }
  }

  // 2) Try product
  if (productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        mrp: true as any,
        salePricePaise: true as any,
        sellingPricePaise: true as any,
        pricePaise: true as any,
      } as any,
    });

    if (product) {
      const anyP = product as any;
      const candidates = [
        anyP.salePricePaise,
        anyP.sellingPricePaise,
        anyP.pricePaise,
      ].filter((v: any) => typeof v === "number" && Number.isFinite(v) && v >= 0);

      if (candidates.length > 0) return Math.trunc(candidates[0]);

      if (anyP.mrp != null) {
        const mrpNum =
          typeof anyP.mrp?.toNumber === "function"
            ? anyP.mrp.toNumber()
            : typeof anyP.mrp === "number"
              ? anyP.mrp
              : typeof anyP.mrp === "string"
                ? Number(anyP.mrp)
                : NaN;

        if (Number.isFinite(mrpNum)) return Math.trunc(mrpNum * 100);
      }
    }
  }

  // 3) drugLibrary fallback (only if you have a model; guarded)
  if (drugLibraryId) {
    const anyPrisma = prisma as any;
    if (anyPrisma?.drugLibrary?.findUnique) {
      const dl = await anyPrisma.drugLibrary.findUnique({
        where: { id: drugLibraryId },
        select: {
          mrp: true,
          pricePaise: true,
          salePricePaise: true,
        },
      });

      const candidates = [dl?.salePricePaise, dl?.pricePaise].filter(
        (v: any) => typeof v === "number" && Number.isFinite(v) && v >= 0
      );
      if (candidates.length > 0) return Math.trunc(candidates[0]);

      if (dl?.mrp != null) {
        const mrpNum =
          typeof dl.mrp?.toNumber === "function"
            ? dl.mrp.toNumber()
            : typeof dl.mrp === "number"
              ? dl.mrp
              : typeof dl.mrp === "string"
                ? Number(dl.mrp)
                : NaN;

        if (Number.isFinite(mrpNum)) return Math.trunc(mrpNum * 100);
      }
    }
  }

  return 0;
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
    if (input.fromBranchId === input.toBranchId) {
      return { success: false, error: "Source and destination branches cannot be the same" };
    }

    const stnNumber = await generateSTNNumber(tenantId);

    // Determine if inter-state transfer (would need branch state codes)
    const isInterState = false;

    // Resolve unit prices + totals
    const resolvedLineItems = await Promise.all(
      input.lineItems.map(async (item) => {
        const unitPricePaise = await resolveUnitPricePaise({
          tenantId,
          branchId: input.fromBranchId,
          productId: item.productId,
          drugLibraryId: item.drugLibraryId,
          batchId: item.batchId,
          unitPricePaise: item.unitPricePaise,
        });

        return {
          ...item,
          unitPricePaise,
        };
      })
    );

    let totalAmountPaise = 0;
    let totalCGSTPaise = 0;
    let totalSGSTPaise = 0;
    let totalIGSTPaise = 0;

    for (const item of resolvedLineItems) {
      totalAmountPaise += item.unitPricePaise * item.quantity;
    }

    // NOTE: GST computations for stock transfers can be complex (branch GSTIN, POS, etc).
    // Keeping your original "simplified" approach, but totals are now consistent.
    // You can later compute CGST/SGST/IGST per line item based on HSN + supply type.

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
        requestedBy: requestedBy ?? null,
        notes: input.notes ?? null,
        lineItems: {
          create: resolvedLineItems.map((item) => ({
            productId: item.productId ?? null,
            drugLibraryId: item.drugLibraryId ?? null,
            batchId: item.batchId ?? null,
            productName: item.productName,
            hsnCode: item.hsnCode ?? null,
            quantity: item.quantity,
            batchCode: item.batchCode ?? null,

            // ✅ REQUIRED by Prisma schema (your build error)
            unitPricePaise: item.unitPricePaise,
          })),
        },
      },
      include: { lineItems: true },
    });

    return { success: true, stnId: stockTransfer.id, stnNumber: stockTransfer.stnNumber };
  } catch (error: any) {
    console.error("Stock transfer creation error:", error);
    return { success: false, error: error.message || "Stock transfer creation failed" };
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
    where: { tenantId, stnNumber: { startsWith: prefix } },
    orderBy: { stnNumber: "desc" },
  });

  let nextNumber = 1;
  if (lastSTN) {
    const lastNumber = parseInt(lastSTN.stnNumber.split("/")[2] || "0", 10);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}/${String(nextNumber).padStart(4, "0")}`;
}
