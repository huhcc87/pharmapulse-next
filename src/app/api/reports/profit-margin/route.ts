// Profit Margin Analysis Report
// GET /api/reports/profit-margin?from=YYYY-MM-DD&to=YYYY-MM-DD

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";

const DEMO_TENANT_ID = 1;

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.nextUrl.searchParams;
    const fromStr = searchParams.get("from") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const toStr = searchParams.get("to") || new Date().toISOString().split("T")[0];

    const fromDate = new Date(fromStr);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(toStr);
    toDate.setHours(23, 59, 59, 999);

    // Get invoices with line items
    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId: DEMO_TENANT_ID,
        invoiceDate: {
          gte: fromDate,
          lte: toDate,
        },
        status: {
          in: ["ISSUED", "FILED"],
        },
      },
      include: {
        lineItems: {
          include: {
            batch: true,
            // product relation doesn't exist in InvoiceLineItem model - removed
          },
        },
      },
    });

    let totalRevenuePaise = 0;
    let totalCostPaise = 0;

    // Calculate revenue and cost
    invoices.forEach((inv) => {
      inv.lineItems.forEach((item) => {
        // Revenue = selling price
        const revenue = item.lineTotalPaise;
        totalRevenuePaise += revenue;

        // Cost = purchase price (from batch or product)
        let costPerUnit = 0;
        if (item.batch?.purchasePrice) {
          costPerUnit = item.batch.purchasePrice * 100; // Convert to paise
        } else if (item.batch?.purchaseCost) {
          costPerUnit = item.batch.purchaseCost * 100; // Convert to paise
        } else {
          // Estimate cost as 80% of selling price (if no purchase price)
          costPerUnit = item.unitPricePaise * 0.8;
        }

        const cost = costPerUnit * item.quantity;
        totalCostPaise += cost;
      });
    });

    const totalRevenue = totalRevenuePaise / 100;
    const totalCost = totalCostPaise / 100;
    const totalProfit = totalRevenue - totalCost;
    const profitMarginPercent = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const grossProfitPercent = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Profit by category (if product has category)
    const categoryProfit: Record<string, { revenue: number; cost: number; profit: number }> = {};
    invoices.forEach((inv) => {
      inv.lineItems.forEach((item) => {
        const category = "Uncategorized"; // TODO: Product relation doesn't exist - use item.productName or fetch separately
        if (!categoryProfit[category]) {
          categoryProfit[category] = { revenue: 0, cost: 0, profit: 0 };
        }
        const revenue = item.lineTotalPaise / 100;
        let costPerUnit = 0;
        if (item.batch?.purchasePrice) {
          costPerUnit = item.batch.purchasePrice;
        } else if (item.batch?.purchaseCost) {
          costPerUnit = item.batch.purchaseCost;
        } else {
          // TODO: Product relation doesn't exist - estimate cost
          costPerUnit = (item.unitPricePaise / 100) * 0.8;
        }
        const cost = costPerUnit * item.quantity;
        categoryProfit[category].revenue += revenue;
        categoryProfit[category].cost += cost;
        categoryProfit[category].profit += revenue - cost;
      });
    });

    const categoryBreakdown = Object.entries(categoryProfit).map(([category, data]) => ({
      category,
      revenue: parseFloat(data.revenue.toFixed(2)),
      cost: parseFloat(data.cost.toFixed(2)),
      profit: parseFloat(data.profit.toFixed(2)),
      marginPercent: data.revenue > 0 ? parseFloat(((data.profit / data.revenue) * 100).toFixed(2)) : 0,
    })).sort((a, b) => b.profit - a.profit);

    return NextResponse.json({
      period: {
        from: fromStr,
        to: toStr,
      },
      summary: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalCost: parseFloat(totalCost.toFixed(2)),
        totalProfit: parseFloat(totalProfit.toFixed(2)),
        profitMarginPercent: parseFloat(profitMarginPercent.toFixed(2)),
        grossProfitPercent: parseFloat(grossProfitPercent.toFixed(2)),
      },
      categoryBreakdown,
    });
  } catch (error: any) {
    console.error("Profit margin report error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
