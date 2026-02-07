// AI Credit Usage Optimization
// Usage prediction, waste detection, optimal purchase timing

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface CreditOptimizationResult {
  predictedUsage?: number; // Next 30 days
  currentBalance: number;
  monthlyGrant: number;
  daysUntilExhaustion?: number;
  isWasteDetected: boolean;
  wasteAlerts?: Array<{
    type: string;
    description: string;
    potentialSavings: number;
  }>;
  optimalPurchaseTiming?: "NOW" | "LATER" | "NOT_NEEDED";
  recommendedTopUpAmount?: number;
  reasoning?: string;
}

/**
 * Analyze credit usage and optimize
 */
export async function analyzeCreditOptimization(
  tenantId: string
): Promise<CreditOptimizationResult> {
  try {
    const result: CreditOptimizationResult = {
      currentBalance: 0,
      monthlyGrant: 0,
      isWasteDetected: false,
    };

    // Get subscription
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      include: {
        creditsLedger: {
          orderBy: {
            createdAt: "desc",
          },
          take: 90, // Last 90 days
        },
      },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    result.currentBalance = subscription.aiCredits - subscription.aiCreditsUsed;
    result.monthlyGrant = subscription.monthlyCreditGrant || 0;

    // Predict usage
    const usageHistory = subscription.creditsLedger.filter(
      (entry) => entry.type === "DEBIT" || entry.type === "USAGE"
    );
    if (usageHistory.length > 0) {
      const avgDailyUsage = calculateAverageDailyUsage(usageHistory);
      result.predictedUsage = Math.ceil(avgDailyUsage * 30); // Next 30 days

      // Calculate days until exhaustion
      if (avgDailyUsage > 0) {
        result.daysUntilExhaustion = Math.floor(result.currentBalance / avgDailyUsage);
      }
    }

    // Detect waste
    const wasteDetection = await detectWaste(tenantId, subscription);
    result.isWasteDetected = wasteDetection.isWaste;
    result.wasteAlerts = wasteDetection.alerts;

    // Optimal purchase timing
    result.optimalPurchaseTiming = determineOptimalPurchaseTiming(result);

    // Recommended top-up amount
    if (result.optimalPurchaseTiming === "NOW") {
      result.recommendedTopUpAmount = calculateRecommendedTopUp(result);
    }

    // Reasoning
    result.reasoning = generateReasoning(result);

    return result;
  } catch (error: any) {
    console.error("Credit optimization analysis error:", error);
    throw error;
  }
}

function calculateAverageDailyUsage(usageHistory: any[]): number {
  if (usageHistory.length === 0) {
    return 0;
  }

  // Group by day
  const dailyUsage: Record<string, number> = {};
  for (const entry of usageHistory) {
    const date = new Date(entry.createdAt).toISOString().split("T")[0];
    dailyUsage[date] = (dailyUsage[date] || 0) + Math.abs(entry.amount || 0);
  }

  const days = Object.keys(dailyUsage).length;
  const totalUsage = Object.values(dailyUsage).reduce((sum, usage) => sum + usage, 0);

  return days > 0 ? totalUsage / days : 0;
}

async function detectWaste(
  tenantId: string,
  subscription: any
): Promise<{
  isWaste: boolean;
  alerts: Array<{
    type: string;
    description: string;
    potentialSavings: number;
  }>;
}> {
  const alerts: Array<{
    type: string;
    description: string;
    potentialSavings: number;
  }> = [];

  // Check for unused credits (high balance, low usage)
  const creditUsageRate = subscription.aiCreditsUsed / (subscription.aiCredits || 1);
  if (creditUsageRate < 0.1 && subscription.aiCredits > 100000) {
    alerts.push({
      type: "LOW_USAGE",
      description: `Only ${(creditUsageRate * 100).toFixed(1)}% of credits used. Consider reducing credit purchases.`,
      potentialSavings: 250000, // Save one top-up
    });
  }

  // Check for expired credits (if credits expire)
  // This would require additional schema/models

  // Check for duplicate purchases
  const recentTopUps = subscription.creditsLedger.filter(
    (entry: any) => entry.type === "CREDIT" && new Date(entry.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );
  if (recentTopUps.length > 2) {
    alerts.push({
      type: "FREQUENT_TOP_UPS",
      description: `${recentTopUps.length} top-ups in the last 7 days. Consider larger top-ups to save.`,
      potentialSavings: 0, // No direct savings, but better planning
    });
  }

  return {
    isWaste: alerts.length > 0,
    alerts,
  };
}

function determineOptimalPurchaseTiming(
  result: CreditOptimizationResult
): "NOW" | "LATER" | "NOT_NEEDED" {
  if (!result.daysUntilExhaustion) {
    return "NOT_NEEDED";
  }

  // If credits will run out in less than 7 days, recommend purchase now
  if (result.daysUntilExhaustion < 7) {
    return "NOW";
  }

  // If credits will run out in 7-14 days, recommend later
  if (result.daysUntilExhaustion < 14) {
    return "LATER";
  }

  // If credits will last more than 14 days, not needed
  return "NOT_NEEDED";
}

function calculateRecommendedTopUp(result: CreditOptimizationResult): number {
  // Standard top-up is 50,000 credits for ₹2,500
  // Recommend based on predicted usage
  if (result.predictedUsage) {
    // Recommend enough to cover next 30 days + buffer
    const recommended = Math.ceil((result.predictedUsage * 1.2) / 50000) * 50000;
    return Math.max(50000, recommended); // Minimum 50,000
  }

  return 50000; // Default top-up
}

function generateReasoning(result: CreditOptimizationResult): string {
  let reasoning = `Credit optimization analysis. Current balance: ${result.currentBalance.toLocaleString()} credits. `;

  if (result.predictedUsage) {
    reasoning += `Predicted usage (next 30 days): ${result.predictedUsage.toLocaleString()} credits. `;
  }

  if (result.daysUntilExhaustion) {
    reasoning += `Credits will last approximately ${result.daysUntilExhaustion} days. `;
  }

  if (result.isWasteDetected && result.wasteAlerts) {
    reasoning += `Detected ${result.wasteAlerts.length} waste alert(s). `;
  }

  if (result.optimalPurchaseTiming) {
    reasoning += `Optimal purchase timing: ${result.optimalPurchaseTiming}. `;
  }

  return reasoning;
}
