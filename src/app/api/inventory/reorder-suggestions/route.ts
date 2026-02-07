// GET /api/inventory/reorder-suggestions
// Get reorder suggestions with demand forecasting

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { generateForecast } from "@/lib/forecasting/algorithm";
import { calculateReorderPoint, calculateSafetyStock } from "@/lib/forecasting/reorder-point";

const DEMO_TENANT_ID = 1;
const DEFAULT_LEAD_TIME_DAYS = 3;
const DEFAULT_SAFETY_STOCK_DAYS = 7;
const DEFAULT_SERVICE_LEVEL = 0.95;

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const { searchParams } = new URL(req.url);
    const horizonDays = parseInt(searchParams.get("horizon") || "30");
    const leadTimeDays = parseInt(searchParams.get("leadTime") || String(DEFAULT_LEAD_TIME_DAYS));
    const safetyStockDays = parseInt(searchParams.get("safetyStock") || String(DEFAULT_SAFETY_STOCK_DAYS));
    const serviceLevel = parseFloat(searchParams.get("serviceLevel") || String(DEFAULT_SERVICE_LEVEL));

    // Get all active products with low stock or recent sales
    const products = await prisma.product.findMany({
      where: {
        // Note: Product model doesn't have tenantId - filtering by isActive only
        isActive: true,
      },
      include: {
        batches: {
          where: { quantityOnHand: { gt: 0 } },
          orderBy: { expiryDate: "asc" },
        },
      },
    });

    const suggestions = [];

    for (const product of products) {
      // Calculate current stock
      const currentStock = product.batches.reduce((sum, b) => sum + b.quantityOnHand, 0);

      // Skip if no stock and no forecast data
      if (currentStock === 0) {
        // Check if product has any sales history
        const hasHistory = await prisma.invoiceLineItem.count({
          where: {
            productId: product.id,
            invoice: {
              status: "ISSUED",
              invoiceDate: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
            },
          },
        });

        if (hasHistory === 0) continue; // Skip products with no history
      }

      // Generate forecast
      const forecast = await generateForecast({
        productId: product.id,
        horizonDays,
        lookbackDays: 90,
      });

      // Calculate reorder point
      const avgDailyDemand = forecast.inputsSummary.avgDailyDemand;

      // Calculate demand standard deviation for safety stock
      const lineItems = await prisma.invoiceLineItem.findMany({
        where: {
          productId: product.id,
          invoice: {
            status: "ISSUED",
            invoiceDate: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
          },
        },
        include: {
          invoice: {
            select: { invoiceDate: true },
          },
        },
      });

      // Calculate daily demand variance
      const dailyDemands: number[] = [];
      const dailyMap = new Map<string, number>();
      for (const item of lineItems) {
        const dateStr = item.invoice.invoiceDate.toISOString().split("T")[0];
        dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + item.quantity);
      }
      dailyDemands.push(...Array.from(dailyMap.values()));

      const demandStdDev =
        dailyDemands.length > 1
          ? Math.sqrt(
              dailyDemands.reduce((sum, d) => sum + Math.pow(d - avgDailyDemand, 2), 0) /
                dailyDemands.length
            )
          : avgDailyDemand * 0.3; // Estimate 30% variation if no data

      const safetyStockUnits = calculateSafetyStock(
        avgDailyDemand,
        demandStdDev,
        leadTimeDays,
        serviceLevel
      );
      const safetyStockDaysCalculated = avgDailyDemand > 0 ? safetyStockUnits / avgDailyDemand : safetyStockDays;

      const reorder = calculateReorderPoint({
        avgDailyDemand,
        leadTimeDays,
        safetyStock: safetyStockDaysCalculated,
        currentStock,
        serviceLevel,
        minOrderQuantity: 0, // Can be fetched from supplier data
      });

      // Only suggest if reorder needed or low stock
      if (reorder.recommendedOrderQty > 0 || currentStock < reorder.reorderPoint) {
        suggestions.push({
          productId: product.id,
          productName: product.name,
          category: product.category,
          currentStock,
          reorderPoint: reorder.reorderPoint,
          recommendedOrderQty: reorder.recommendedOrderQty,
          stockCoverDays: reorder.stockCoverDays,
          avgDailyDemand,
          forecastQty: forecast.forecastQty,
          confidenceLevel: forecast.confidenceLevel,
          trend: forecast.inputsSummary.trend,
          explanation: reorder.explanation,
          forecastDetails: {
            horizonDays,
            lookbackDays: forecast.inputsSummary.lookbackDays,
            dataPoints: forecast.inputsSummary.dataPoints,
          },
        });
      }
    }

    // Sort by priority (low stock cover days first, then low confidence)
    suggestions.sort((a, b) => {
      if (a.stockCoverDays !== b.stockCoverDays) {
        return a.stockCoverDays - b.stockCoverDays;
      }
      return a.confidenceLevel - b.confidenceLevel;
    });

    return NextResponse.json({
      suggestions,
      total: suggestions.length,
      parameters: {
        horizonDays,
        leadTimeDays,
        safetyStockDays,
        serviceLevel,
      },
    });
  } catch (error: any) {
    console.error("Reorder suggestions error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate reorder suggestions" },
      { status: 500 }
    );
  }
}
