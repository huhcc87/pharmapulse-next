// POST /api/inventory/auto-reorder
// Auto-generate purchase orders when stock falls below reorder point

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateReorderPoint } from "@/lib/forecasting/reorder-point";

const DEMO_TENANT_ID = 1;

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { enabled = true, checkIntervalMinutes = 60 } = body;

    if (!enabled) {
      return NextResponse.json({ message: "Auto reorder disabled" });
    }

    // Get all products with active auto reorder rules
    // Note: Product model doesn't have tenantId - filtering by isActive only
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        // In production, add: autoReorderEnabled: true
      },
      include: {
        batches: {
          where: { quantityOnHand: { gt: 0 } },
        },
      },
    });

    const generatedPOs = [];

    for (const product of products) {
      // Calculate current stock
      const currentStock = product.batches.reduce(
        (sum, b) => sum + b.quantityOnHand,
        0
      );

      // Check if below reorder point
      if (currentStock > product.minStock) {
        continue; // Stock is sufficient
      }

      // Get sales history (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const lineItems = await prisma.invoiceLineItem.findMany({
        where: {
          productId: product.id,
          invoice: {
            status: "ISSUED",
            invoiceDate: { gte: thirtyDaysAgo },
          },
        },
        include: {
          invoice: {
            select: { invoiceDate: true },
          },
        },
      });

      // Calculate average daily demand
      const totalQty = lineItems.reduce((sum, item) => sum + item.quantity, 0);
      const avgDailyDemand = totalQty / 30;

      if (avgDailyDemand === 0) {
        continue; // No sales history, skip
      }

      // Calculate reorder point
      const reorderResult = calculateReorderPoint({
        avgDailyDemand,
        leadTimeDays: 7, // Default 7 days for Indian market
        safetyStock: 7, // 7 days safety stock
        currentStock,
        minOrderQuantity: 10, // Default MOQ
      });

      if (reorderResult.recommendedOrderQty === 0) {
        continue; // No reorder needed
      }

      // Find best supplier based on price history
      const vendors = await prisma.vendor.findMany({
        where: {
          tenantId: DEMO_TENANT_ID,
          isActive: true,
        },
      });

      // For now, use first available vendor
      // In production, use price history to select best vendor
      const selectedVendor = vendors[0];

      if (!selectedVendor) {
        console.warn(`No vendor found for product ${product.name}`);
        continue;
      }

      // Generate PO
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const prefix = `PO/${year}-${month}`;

      const lastPO = await prisma.purchaseOrder.findFirst({
        where: {
          tenantId: DEMO_TENANT_ID,
          poNumber: { startsWith: prefix },
        },
        orderBy: { poNumber: "desc" },
      });

      let nextNumber = 1;
      if (lastPO) {
        const lastNumber = parseInt(lastPO.poNumber.split("/")[2] || "0");
        nextNumber = lastNumber + 1;
      }

      const poNumber = `${prefix}/${String(nextNumber).padStart(4, "0")}`;

      // Get product price (use last purchase price or MRP)
      const lastBatch = product.batches[0];
      const unitPrice = lastBatch?.purchasePrice || product.unitPrice || 0;

      // Create PO
      const po = await prisma.purchaseOrder.create({
        data: {
          poNumber,
          tenantId: DEMO_TENANT_ID,
          vendorId: selectedVendor.id,
          poDate: now,
          expectedDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
          status: "DRAFT",
          totalAmountPaise: Math.round(reorderResult.recommendedOrderQty * unitPrice * 100),
          notes: `Auto-generated: Stock below reorder point (${currentStock} < ${product.minStock})`,
          lineItems: {
            create: {
              productId: product.id,
              productName: product.name,
              quantity: reorderResult.recommendedOrderQty,
              unitPricePaise: Math.round(unitPrice * 100),
              lineTotalPaise: Math.round(
                reorderResult.recommendedOrderQty * unitPrice * 100
              ),
            },
          },
        },
      });

      generatedPOs.push({
        poNumber: po.poNumber,
        productName: product.name,
        quantity: reorderResult.recommendedOrderQty,
        currentStock,
        reorderPoint: reorderResult.reorderPoint,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${generatedPOs.length} purchase orders`,
      purchaseOrders: generatedPOs,
    });
  } catch (error: any) {
    console.error("Auto reorder error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to auto-generate POs" },
      { status: 500 }
    );
  }
}

// GET /api/inventory/auto-reorder - Get auto reorder status
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    // Get products that need reordering
    // Note: Product model doesn't have tenantId - filtering by isActive only
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
      },
      include: {
        batches: {
          where: { quantityOnHand: { gt: 0 } },
        },
      },
    });

    const needsReorder = products
      .filter((p) => {
        const currentStock = p.batches.reduce(
          (sum, b) => sum + b.quantityOnHand,
          0
        );
        return currentStock <= p.minStock;
      })
      .map((p) => ({
        productId: p.id,
        productName: p.name,
        currentStock: p.batches.reduce(
          (sum, b) => sum + b.quantityOnHand,
          0
        ),
        minStock: p.minStock,
      }));

    return NextResponse.json({
      needsReorder: needsReorder.length,
      products: needsReorder,
    });
  } catch (error: any) {
    console.error("Auto reorder status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get auto reorder status" },
      { status: 500 }
    );
  }
}
