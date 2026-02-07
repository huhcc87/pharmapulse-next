// AI Cost Optimization & Forecasting
// Cost predictions, anomaly detection, budget alerts, optimization suggestions

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface CostForecastResult {
  predictedCostPaise: number;
  currentCostPaise: number;
  previousCostPaise?: number;
  subscriptionCostPaise: number;
  creditsCostPaise: number;
  addonsCostPaise: number;
  isAnomaly: boolean;
  anomalyReason?: string;
  budgetLimitPaise?: number;
  budgetAlertLevel?: "NONE" | "WARNING" | "CRITICAL";
  optimizationSuggestions?: Array<{
    category: string;
    suggestion: string;
    potentialSavingsPaise: number;
  }>;
  potentialSavingsPaise?: number;
  confidenceScore: number; // 0-100
  reasoning?: string;
}

/**
 * Generate cost forecast
 */
export async function generateCostForecast(
  tenantId: string,
  forecastPeriod: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" = "MONTHLY"
): Promise<CostForecastResult> {
  try {
    const result: CostForecastResult = {
      predictedCostPaise: 0,
      currentCostPaise: 0,
      subscriptionCostPaise: 0,
      creditsCostPaise: 0,
      addonsCostPaise: 0,
      isAnomaly: false,
      confidenceScore: 80,
    };

    // Get current costs
    const currentCosts = await getCurrentCosts(tenantId);
    result.currentCostPaise = currentCosts.total;
    result.subscriptionCostPaise = currentCosts.subscription;
    result.creditsCostPaise = currentCosts.credits;
    result.addonsCostPaise = currentCosts.addons;

    // Get previous period costs for comparison
    const previousCosts = await getPreviousPeriodCosts(tenantId, forecastPeriod);
    if (previousCosts) {
      result.previousCostPaise = previousCosts.total;
    }

    // Predict future costs (simple linear projection with trend)
    const costHistory = await getCostHistory(tenantId, forecastPeriod);
    if (costHistory.length > 0) {
      const trend = calculateTrend(costHistory);
      const baseCost = result.currentCostPaise;
      
      // Project based on period
      let multiplier = 1;
      if (forecastPeriod === "WEEKLY") {
        multiplier = 1;
      } else if (forecastPeriod === "MONTHLY") {
        multiplier = 1;
      } else if (forecastPeriod === "QUARTERLY") {
        multiplier = 3;
      } else if (forecastPeriod === "YEARLY") {
        multiplier = 12;
      }

      result.predictedCostPaise = Math.round(baseCost * multiplier * (1 + trend));
    } else {
      // No history, use current cost
      result.predictedCostPaise = result.currentCostPaise;
      result.confidenceScore = 50; // Lower confidence without history
    }

    // Anomaly detection
    if (result.previousCostPaise) {
      const changePercent = ((result.currentCostPaise - result.previousCostPaise) / result.previousCostPaise) * 100;
      if (Math.abs(changePercent) > 30) {
        result.isAnomaly = true;
        result.anomalyReason = `Cost ${changePercent > 0 ? "increased" : "decreased"} by ${Math.abs(changePercent).toFixed(1)}% compared to previous period`;
      }
    }

    // Check budget
    const budget = await getActiveBudget(tenantId, forecastPeriod);
    if (budget) {
      result.budgetLimitPaise = budget.limitPaise;
      const usagePercent = (result.predictedCostPaise / budget.limitPaise) * 100;
      
      if (usagePercent >= 100) {
        result.budgetAlertLevel = "CRITICAL";
      } else if (usagePercent >= 80) {
        result.budgetAlertLevel = "WARNING";
      } else {
        result.budgetAlertLevel = "NONE";
      }
    }

    // Generate optimization suggestions
    result.optimizationSuggestions = await generateOptimizationSuggestions(
      tenantId,
      result
    );

    // Calculate potential savings
    if (result.optimizationSuggestions && result.optimizationSuggestions.length > 0) {
      result.potentialSavingsPaise = result.optimizationSuggestions.reduce(
        (sum, s) => sum + s.potentialSavingsPaise,
        0
      );
    }

    // Reasoning
    result.reasoning = generateReasoning(result, forecastPeriod);

    return result;
  } catch (error: any) {
    console.error("Cost forecast generation error:", error);
    throw error;
  }
}

async function getCurrentCosts(tenantId: string): Promise<{
  total: number;
  subscription: number;
  credits: number;
  addons: number;
}> {
  // Get subscription cost
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
  });

  let subscriptionCost = 0;
  if (subscription) {
    // Annual subscription cost (₹15,000 = 1,500,000 paise)
    subscriptionCost = 1500000; // One-time purchase
    // Add renewal if active
    if (subscription.serviceRenewalStatus === "ACTIVE") {
      subscriptionCost += 100000; // ₹1,000/year renewal
    }
  }

  // Get credits cost (top-ups)
  const creditTopUps = await prisma.creditsLedger.findMany({
    where: {
      tenantId,
      type: "PURCHASE",
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    },
  });

  const creditsCost = creditTopUps.reduce((sum, entry) => {
    // Each top-up is ₹2,500 for 50,000 credits
    return sum + 250000; // 250,000 paise
  }, 0);

  // Addons cost (placeholder)
  const addonsCost = 0;

  return {
    total: subscriptionCost + creditsCost + addonsCost,
    subscription: subscriptionCost,
    credits: creditsCost,
    addons: addonsCost,
  };
}

async function getPreviousPeriodCosts(
  tenantId: string,
  period: string
): Promise<{ total: number } | null> {
  // Get cost from previous period
  const previousForecast = await prisma.aICostForecast.findFirst({
    where: {
      tenantId,
      forecastPeriod: period,
    },
    orderBy: {
      forecastDate: "desc",
    },
  });

  if (previousForecast) {
    return {
      total: previousForecast.currentCostPaise,
    };
  }

  return null;
}

async function getCostHistory(
  tenantId: string,
  period: string
): Promise<Array<{ date: Date; cost: number }>> {
  const forecasts = await prisma.aICostForecast.findMany({
    where: {
      tenantId,
      forecastPeriod: period,
    },
    orderBy: {
      forecastDate: "asc",
    },
    take: 12, // Last 12 periods
  });

  return forecasts.map((f) => ({
    date: f.forecastDate,
    cost: f.currentCostPaise,
  }));
}

function calculateTrend(history: Array<{ date: Date; cost: number }>): number {
  if (history.length < 2) {
    return 0;
  }

  // Simple linear trend
  const first = history[0].cost;
  const last = history[history.length - 1].cost;
  const trend = (last - first) / first;

  return trend;
}

async function getActiveBudget(
  tenantId: string,
  period: string
): Promise<{ limitPaise: number } | null> {
  const budget = await prisma.budget.findFirst({
    where: {
      tenantId,
      budgetType: period === "MONTHLY" ? "MONTHLY" : "ANNUAL",
      isActive: true,
    },
  });

  if (budget) {
    return {
      limitPaise: budget.limitPaise,
    };
  }

  return null;
}

async function generateOptimizationSuggestions(
  tenantId: string,
  forecast: CostForecastResult
): Promise<Array<{
  category: string;
  suggestion: string;
  potentialSavingsPaise: number;
}>> {
  const suggestions: Array<{
    category: string;
    suggestion: string;
    potentialSavingsPaise: number;
  }> = [];

  // Check for unused credits
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
  });

  if (subscription) {
    const creditBalance = subscription.aiCredits - subscription.aiCreditsUsed;
    if (creditBalance > 50000) {
      suggestions.push({
        category: "CREDITS",
        suggestion: "You have unused credits. Consider reducing credit purchases until balance is lower.",
        potentialSavingsPaise: 250000, // Save one top-up
      });
    }
  }

  // Check for high credit usage
  if (forecast.creditsCostPaise > forecast.subscriptionCostPaise) {
    suggestions.push({
      category: "CREDITS",
      suggestion: "Credit costs exceed subscription. Consider upgrading to a plan with more included credits.",
      potentialSavingsPaise: Math.round(forecast.creditsCostPaise * 0.2), // 20% savings
    });
  }

  return suggestions;
}

function generateReasoning(
  forecast: CostForecastResult,
  period: string
): string {
  let reasoning = `Cost forecast for ${period.toLowerCase()} period. `;
  
  if (forecast.previousCostPaise) {
    const change = forecast.predictedCostPaise - forecast.previousCostPaise;
    reasoning += `Predicted cost is ${change > 0 ? "higher" : "lower"} by ₹${Math.abs(change) / 100} compared to previous period. `;
  }

  if (forecast.isAnomaly) {
    reasoning += `Anomaly detected: ${forecast.anomalyReason}. `;
  }

  if (forecast.budgetAlertLevel === "CRITICAL") {
    reasoning += "Budget limit will be exceeded. ";
  } else if (forecast.budgetAlertLevel === "WARNING") {
    reasoning += "Approaching budget limit. ";
  }

  if (forecast.optimizationSuggestions && forecast.optimizationSuggestions.length > 0) {
    reasoning += `Found ${forecast.optimizationSuggestions.length} optimization opportunities. `;
  }

  return reasoning;
}
