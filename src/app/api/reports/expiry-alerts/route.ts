// Expiry Alerts Report
// GET /api/reports/expiry-alerts?days=90

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";

const DEMO_TENANT_ID = 1;

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "90");
    const alertDate = new Date();
    alertDate.setDate(alertDate.getDate() + days);

    // Get batches expiring soon
    const expiringBatches = await prisma.batch.findMany({
      where: {
        expiryDate: {
          lte: alertDate,
        },
        quantityOnHand: {
          gt: 0,
        },
        product: {
          isActive: true,
        },
      },
      include: {
        product: true,
      },
      orderBy: {
        expiryDate: "asc",
      },
    });

    // Group by expiry timeframe
    const now = new Date();
    const days30 = new Date();
    days30.setDate(days30.getDate() + 30);
    const days60 = new Date();
    days60.setDate(days60.getDate() + 60);
    const days90 = new Date();
    days90.setDate(days90.getDate() + 90);

    const alerts30Days = expiringBatches.filter(
      (batch) => batch.expiryDate <= days30
    );
    const alerts60Days = expiringBatches.filter(
      (batch) => batch.expiryDate > days30 && batch.expiryDate <= days60
    );
    const alerts90Days = expiringBatches.filter(
      (batch) => batch.expiryDate > days60 && batch.expiryDate <= days90
    );

    // Calculate total value
    const totalValuePaise = expiringBatches.reduce((sum, batch) => {
      const value = (batch.purchasePrice || batch.product?.unitPrice || 0) * batch.quantityOnHand;
      return sum + value * 100; // Convert to paise
    }, 0);

    return NextResponse.json({
      days,
      alerts: {
        "30days": {
          count: alerts30Days.length,
          batches: alerts30Days.slice(0, 20).map((batch) => ({
            id: batch.id,
            productName: batch.product?.name || "Unknown",
            batchCode: batch.batchCode,
            expiryDate: batch.expiryDate.toISOString(),
            quantityOnHand: batch.quantityOnHand,
            daysUntilExpiry: Math.ceil(
              (batch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            ),
            value: ((batch.purchasePrice || batch.product?.unitPrice || 0) * batch.quantityOnHand),
          })),
        },
        "60days": {
          count: alerts60Days.length,
          batches: alerts60Days.slice(0, 20).map((batch) => ({
            id: batch.id,
            productName: batch.product?.name || "Unknown",
            batchCode: batch.batchCode,
            expiryDate: batch.expiryDate.toISOString(),
            quantityOnHand: batch.quantityOnHand,
            daysUntilExpiry: Math.ceil(
              (batch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            ),
            value: ((batch.purchasePrice || batch.product?.unitPrice || 0) * batch.quantityOnHand),
          })),
        },
        "90days": {
          count: alerts90Days.length,
          batches: alerts90Days.slice(0, 20).map((batch) => ({
            id: batch.id,
            productName: batch.product?.name || "Unknown",
            batchCode: batch.batchCode,
            expiryDate: batch.expiryDate.toISOString(),
            quantityOnHand: batch.quantityOnHand,
            daysUntilExpiry: Math.ceil(
              (batch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            ),
            value: ((batch.purchasePrice || batch.product?.unitPrice || 0) * batch.quantityOnHand),
          })),
        },
      },
      totalValue: totalValuePaise / 100,
      totalBatches: expiringBatches.length,
    });
  } catch (error: any) {
    console.error("Expiry alerts report error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
