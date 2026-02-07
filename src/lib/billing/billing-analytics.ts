// Billing Analytics Dashboard
// Spending trends, cost breakdown, usage vs cost correlation, forecasting

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface SpendingTrend {
  period: string;
  amountPaise: number;
  category: string;
}

export interface CostBreakdown {
  category: string;
  amountPaise: number;
  percentage: number;
}

export interface UsageCostCorrelation {
  period: string;
  creditsUsed: number;
  costPaise: number;
  costPerCredit: number;
}

/**
 * Get spending trends
 */
export async function getSpendingTrends(
  tenantId: string,
  period: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" = "MONTHLY",
  months: number = 12
): Promise<SpendingTrend[]> {
  try {
    const trends: SpendingTrend[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      // Get payments for this period
      const payments = await prisma.billingPayment.findMany({
        where: {
          tenantId,
          status: "SUCCESS",
          createdAt: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
      });

      const totalAmount = payments.reduce((sum, p) => sum + (p.amountPaise || 0), 0);

      trends.push({
        period: `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`,
        amountPaise: totalAmount,
        category: "TOTAL",
      });
    }

    return trends;
  } catch (error: any) {
    console.error("Get spending trends error:", error);
    throw error;
  }
}

/**
 * Get cost breakdown
 */
export async function getCostBreakdown(
  tenantId: string,
  period: "MONTHLY" | "QUARTERLY" | "YEARLY" = "MONTHLY"
): Promise<CostBreakdown[]> {
  try {
    const now = new Date();
    let startDate: Date;

    if (period === "MONTHLY") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "QUARTERLY") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    } else {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    // Get payments by category
    const payments = await prisma.billingPayment.findMany({
      where: {
        tenantId,
        status: "SUCCESS",
        createdAt: {
          gte: startDate,
        },
      },
    });

    const categoryTotals: Record<string, number> = {
      SUBSCRIPTION: 0,
      CREDITS: 0,
      ADDONS: 0,
      OTHER: 0,
    };

    for (const payment of payments) {
      const category = (payment.metadata as any)?.category || "OTHER";
      categoryTotals[category] = (categoryTotals[category] || 0) + (payment.amountPaise || 0);
    }

    const total = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

    const breakdown: CostBreakdown[] = Object.entries(categoryTotals).map(([category, amount]) => ({
      category,
      amountPaise: amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }));

    return breakdown;
  } catch (error: any) {
    console.error("Get cost breakdown error:", error);
    throw error;
  }
}

/**
 * Get usage vs cost correlation
 */
export async function getUsageCostCorrelation(
  tenantId: string,
  period: "MONTHLY" | "QUARTERLY" | "YEARLY" = "MONTHLY",
  months: number = 6
): Promise<UsageCostCorrelation[]> {
  try {
    const correlations: UsageCostCorrelation[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      // Get credit usage
      const creditUsage = await prisma.creditsLedger.findMany({
        where: {
          tenantId,
          type: {
            in: ["USAGE", "DEBIT"],
          },
          createdAt: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
      });

      const creditsUsed = creditUsage.reduce((sum, entry) => sum + Math.abs(entry.amount || 0), 0);

      // Get costs
      const payments = await prisma.billingPayment.findMany({
        where: {
          tenantId,
          status: "SUCCESS",
          createdAt: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
      });

      const costPaise = payments.reduce((sum, p) => sum + (p.amountPaise || 0), 0);
      const costPerCredit = creditsUsed > 0 ? costPaise / creditsUsed : 0;

      correlations.push({
        period: `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`,
        creditsUsed,
        costPaise,
        costPerCredit,
      });
    }

    return correlations;
  } catch (error: any) {
    console.error("Get usage cost correlation error:", error);
    throw error;
  }
}

/**
 * Get forecasting data
 */
export async function getForecastingData(
  tenantId: string
): Promise<{
  predictedCostNextMonth: number;
  predictedCostNextQuarter: number;
  predictedCostNextYear: number;
  confidence: number;
}> {
  try {
    // Get historical data
    const trends = await getSpendingTrends(tenantId, "MONTHLY", 6);

    if (trends.length < 2) {
      return {
        predictedCostNextMonth: 0,
        predictedCostNextQuarter: 0,
        predictedCostNextYear: 0,
        confidence: 0,
      };
    }

    // Simple linear projection
    const recent = trends.slice(-3);
    const avgMonthly = recent.reduce((sum, t) => sum + t.amountPaise, 0) / recent.length;

    // Calculate trend
    const first = trends[0].amountPaise;
    const last = trends[trends.length - 1].amountPaise;
    const trend = (last - first) / trends.length;

    return {
      predictedCostNextMonth: Math.max(0, avgMonthly + trend),
      predictedCostNextQuarter: Math.max(0, (avgMonthly + trend) * 3),
      predictedCostNextYear: Math.max(0, (avgMonthly + trend) * 12),
      confidence: trends.length >= 6 ? 80 : 50,
    };
  } catch (error: any) {
    console.error("Get forecasting data error:", error);
    throw error;
  }
}
