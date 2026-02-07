// Demand forecasting algorithm with moving average and seasonality

import { prisma } from "@/server/prisma";

export interface ForecastInput {
  productId: number;
  horizonDays: number; // 7, 14, or 30
  lookbackDays?: number; // Default 90-180
}

export interface ForecastResult {
  productId: number;
  horizonDays: number;
  forecastQty: number;
  confidenceLevel: number;
  inputsSummary: {
    avgDailyDemand: number;
    lookbackDays: number;
    dataPoints: number;
    trend: "INCREASING" | "DECREASING" | "STABLE";
    seasonality: number;
  };
  forecastSeries?: Array<{ date: string; qty: number }>;
}

/**
 * Calculate moving average with weekly seasonality
 */
function calculateMovingAverage(
  dailySales: Array<{ date: Date; qty: number }>,
  windowDays: number = 7
): number {
  if (dailySales.length === 0) return 0;

  const recentSales = dailySales.slice(-windowDays);
  const total = recentSales.reduce((sum, d) => sum + d.qty, 0);
  return total / recentSales.length;
}

/**
 * Detect weekly seasonality (e.g., higher sales on weekends)
 */
function calculateSeasonality(dailySales: Array<{ date: Date; qty: number }>): number {
  if (dailySales.length < 7) return 1.0;

  // Group by day of week
  const byDayOfWeek: Record<number, number[]> = {};
  for (const sale of dailySales) {
    const dayOfWeek = sale.date.getDay(); // 0 = Sunday, 6 = Saturday
    if (!byDayOfWeek[dayOfWeek]) {
      byDayOfWeek[dayOfWeek] = [];
    }
    byDayOfWeek[dayOfWeek].push(sale.qty);
  }

  // Calculate average per day of week
  const dayAverages: Record<number, number> = {};
  for (const [day, qtys] of Object.entries(byDayOfWeek)) {
    dayAverages[parseInt(day)] = qtys.reduce((a, b) => a + b, 0) / qtys.length;
  }

  // Calculate overall average
  const overallAvg =
    Object.values(dayAverages).reduce((a, b) => a + b, 0) / Object.keys(dayAverages).length;

  // Seasonality factor (normalized)
  const seasonality = overallAvg > 0 ? 1.0 : 1.0; // Simplified - can be enhanced

  return seasonality;
}

/**
 * Detect trend (increasing, decreasing, stable)
 */
function detectTrend(
  dailySales: Array<{ date: Date; qty: number }>
): "INCREASING" | "DECREASING" | "STABLE" {
  if (dailySales.length < 14) return "STABLE";

  const firstHalf = dailySales.slice(0, Math.floor(dailySales.length / 2));
  const secondHalf = dailySales.slice(Math.floor(dailySales.length / 2));

  const firstAvg = firstHalf.reduce((sum, d) => sum + d.qty, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, d) => sum + d.qty, 0) / secondHalf.length;

  const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

  if (changePercent > 10) return "INCREASING";
  if (changePercent < -10) return "DECREASING";
  return "STABLE";
}

/**
 * Generate demand forecast for a product
 */
export async function generateForecast(
  input: ForecastInput
): Promise<ForecastResult> {
  const { productId, horizonDays, lookbackDays = 90 } = input;

  // Get historical sales data (last N days)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - lookbackDays);

  // Query invoice line items for this product
  const lineItems = await prisma.invoiceLineItem.findMany({
    where: {
      productId,
      invoice: {
        status: "ISSUED",
        invoiceDate: { gte: startDate },
      },
    },
    include: {
      invoice: {
        select: {
          invoiceDate: true,
        },
      },
    },
    orderBy: {
      invoice: {
        invoiceDate: "asc",
      },
    },
  });

  // Aggregate by date
  const dailySalesMap = new Map<string, number>();
  for (const item of lineItems) {
    const dateStr = item.invoice.invoiceDate.toISOString().split("T")[0];
    const current = dailySalesMap.get(dateStr) || 0;
    dailySalesMap.set(dateStr, current + item.quantity);
  }

  const dailySales = Array.from(dailySalesMap.entries())
    .map(([dateStr, qty]) => ({
      date: new Date(dateStr),
      qty,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Calculate metrics
  const avgDailyDemand = dailySales.length > 0
    ? dailySales.reduce((sum, d) => sum + d.qty, 0) / dailySales.length
    : 0;

  const movingAvg = calculateMovingAverage(dailySales, 7);
  const seasonality = calculateSeasonality(dailySales);
  const trend = detectTrend(dailySales);

  // Apply exponential smoothing
  const alpha = 0.3; // Smoothing factor
  const smoothed = dailySales.length > 0
    ? alpha * dailySales[dailySales.length - 1].qty + (1 - alpha) * movingAvg
    : movingAvg;

  // Forecast quantity
  let forecastQty = smoothed * horizonDays * seasonality;

  // Adjust for trend
  if (trend === "INCREASING") {
    forecastQty *= 1.1; // 10% upward adjustment
  } else if (trend === "DECREASING") {
    forecastQty *= 0.9; // 10% downward adjustment
  }

  // Round to integer
  forecastQty = Math.round(forecastQty);

  // Calculate confidence (based on data points and variance)
  let confidenceLevel = 0.5; // Base confidence
  if (dailySales.length >= 30) {
    confidenceLevel = 0.8; // High confidence with 30+ days
  } else if (dailySales.length >= 14) {
    confidenceLevel = 0.7; // Medium confidence with 14+ days
  } else if (dailySales.length >= 7) {
    confidenceLevel = 0.6; // Low confidence with 7+ days
  }

  // Reduce confidence if high variance
  if (dailySales.length > 0) {
    const variance =
      dailySales.reduce((sum, d) => sum + Math.pow(d.qty - avgDailyDemand, 2), 0) /
      dailySales.length;
    const stdDev = Math.sqrt(variance);
    const cv = avgDailyDemand > 0 ? stdDev / avgDailyDemand : 1; // Coefficient of variation

    if (cv > 0.5) {
      confidenceLevel *= 0.8; // Reduce confidence for high variance
    }
  }

  // Generate forecast series (daily breakdown)
  const forecastSeries: Array<{ date: string; qty: number }> = [];
  const dailyForecast = forecastQty / horizonDays;
  for (let i = 0; i < horizonDays; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    forecastSeries.push({
      date: date.toISOString().split("T")[0],
      qty: Math.round(dailyForecast),
    });
  }

  return {
    productId,
    horizonDays,
    forecastQty,
    confidenceLevel: Math.min(confidenceLevel, 0.95), // Cap at 95%
    inputsSummary: {
      avgDailyDemand,
      lookbackDays,
      dataPoints: dailySales.length,
      trend,
      seasonality,
    },
    forecastSeries,
  };
}
