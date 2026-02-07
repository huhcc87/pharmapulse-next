// AI Subscription Management
// Churn prediction, plan recommendations, auto-scaling suggestions

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface SubscriptionHealthResult {
  healthScore: number; // 0-100
  healthStatus: "HEALTHY" | "AT_RISK" | "CRITICAL";
  churnProbability?: number; // 0-100
  churnRiskFactors?: string[];
  recommendedPlan?: string;
  recommendedAction?: string;
  usageTrend?: "INCREASING" | "DECREASING" | "STABLE";
  renewalLikelihood?: number; // 0-100
  reasoning?: string;
}

/**
 * Analyze subscription health
 */
export async function analyzeSubscriptionHealth(
  tenantId: string,
  subscriptionId: string
): Promise<SubscriptionHealthResult> {
  try {
    const result: SubscriptionHealthResult = {
      healthScore: 100,
      healthStatus: "HEALTHY",
    };

    // Get subscription
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        billingPayments: {
          orderBy: {
            createdAt: "desc",
          },
          take: 12,
        },
        creditsLedger: {
          orderBy: {
            createdAt: "desc",
          },
          take: 30,
        },
      },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Calculate health score
    result.healthScore = calculateHealthScore(subscription);

    // Determine health status
    if (result.healthScore >= 80) {
      result.healthStatus = "HEALTHY";
    } else if (result.healthScore >= 50) {
      result.healthStatus = "AT_RISK";
    } else {
      result.healthStatus = "CRITICAL";
    }

    // Churn prediction
    const churnPrediction = await predictChurn(tenantId, subscription);
    result.churnProbability = churnPrediction.probability;
    result.churnRiskFactors = churnPrediction.riskFactors;

    // Usage trend
    result.usageTrend = calculateUsageTrend(subscription.creditsLedger);

    // Renewal likelihood
    result.renewalLikelihood = calculateRenewalLikelihood(subscription, result);

    // Plan recommendation
    result.recommendedPlan = recommendPlan(subscription, result);

    // Recommended action
    result.recommendedAction = generateRecommendedAction(result);

    // Reasoning
    result.reasoning = generateReasoning(result, subscription);

    return result;
  } catch (error: any) {
    console.error("Subscription health analysis error:", error);
    throw error;
  }
}

function calculateHealthScore(subscription: any): number {
  let score = 100;

  // Check subscription status
  if (subscription.status === "expired") {
    score -= 50;
  } else if (subscription.status === "past_due") {
    score -= 30;
  }

  // Check renewal status
  if (subscription.serviceRenewalStatus === "PAST_DUE") {
    score -= 40;
  } else if (subscription.serviceRenewalStatus === "INACTIVE") {
    score -= 20;
  }

  // Check payment history
  const recentPayments = subscription.billingPayments.filter(
    (p: any) => p.status === "SUCCESS"
  );
  if (recentPayments.length === 0) {
    score -= 30;
  }

  // Check credit usage
  const creditUsageRate = subscription.aiCreditsUsed / (subscription.aiCredits || 1);
  if (creditUsageRate > 0.9) {
    score -= 20; // High usage, might need upgrade
  } else if (creditUsageRate < 0.1) {
    score -= 10; // Low usage, might downgrade
  }

  return Math.max(0, Math.min(100, score));
}

async function predictChurn(
  tenantId: string,
  subscription: any
): Promise<{
  probability: number;
  riskFactors: string[];
}> {
  const riskFactors: string[] = [];
  let probability = 0;

  // Check subscription status
  if (subscription.status === "expired") {
    probability += 80;
    riskFactors.push("Subscription expired");
  } else if (subscription.status === "past_due") {
    probability += 60;
    riskFactors.push("Payment past due");
  }

  // Check renewal status
  if (subscription.serviceRenewalStatus === "PAST_DUE") {
    probability += 50;
    riskFactors.push("Service renewal past due");
  } else if (subscription.serviceRenewalStatus === "INACTIVE") {
    probability += 30;
    riskFactors.push("Service renewal inactive");
  }

  // Check for recent payments
  const recentPayments = subscription.billingPayments.filter(
    (p: any) => p.status === "SUCCESS" && new Date(p.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  if (recentPayments.length === 0) {
    probability += 20;
    riskFactors.push("No recent payments");
  }

  // Check credit usage
  const creditUsageRate = subscription.aiCreditsUsed / (subscription.aiCredits || 1);
  if (creditUsageRate < 0.05) {
    probability += 15;
    riskFactors.push("Very low credit usage (underutilization)");
  }

  return {
    probability: Math.min(100, probability),
    riskFactors,
  };
}

function calculateUsageTrend(
  creditsLedger: any[]
): "INCREASING" | "DECREASING" | "STABLE" {
  if (creditsLedger.length < 2) {
    return "STABLE";
  }

  // Compare last 15 days vs previous 15 days
  const now = new Date();
  const last15Days = creditsLedger.filter(
    (entry) => new Date(entry.createdAt) > new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000)
  );
  const previous15Days = creditsLedger.filter(
    (entry) => {
      const date = new Date(entry.createdAt);
      return date > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) &&
             date <= new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    }
  );

  const lastUsage = last15Days.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
  const previousUsage = previous15Days.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);

  if (lastUsage > previousUsage * 1.2) {
    return "INCREASING";
  } else if (lastUsage < previousUsage * 0.8) {
    return "DECREASING";
  } else {
    return "STABLE";
  }
}

function calculateRenewalLikelihood(
  subscription: any,
  health: SubscriptionHealthResult
): number {
  let likelihood = 100;

  // Deduct based on health status
  if (health.healthStatus === "CRITICAL") {
    likelihood -= 50;
  } else if (health.healthStatus === "AT_RISK") {
    likelihood -= 30;
  }

  // Deduct based on churn probability
  if (health.churnProbability) {
    likelihood -= health.churnProbability * 0.5;
  }

  // Check payment history
  const recentPayments = subscription.billingPayments.filter(
    (p: any) => p.status === "SUCCESS"
  );
  if (recentPayments.length === 0) {
    likelihood -= 40;
  }

  return Math.max(0, Math.min(100, likelihood));
}

function recommendPlan(subscription: any, health: SubscriptionHealthResult): string | undefined {
  const creditUsageRate = subscription.aiCreditsUsed / (subscription.aiCredits || 1);

  if (creditUsageRate > 0.9 && health.usageTrend === "INCREASING") {
    return "UPGRADE";
  } else if (creditUsageRate < 0.1 && health.usageTrend === "DECREASING") {
    return "DOWNGRADE";
  }

  return undefined;
}

function generateRecommendedAction(health: SubscriptionHealthResult): string {
  if (health.healthStatus === "CRITICAL") {
    return "Immediate action required. Contact customer to prevent churn.";
  } else if (health.healthStatus === "AT_RISK") {
    return "Monitor closely. Consider offering incentives to improve engagement.";
  } else if (health.churnProbability && health.churnProbability > 50) {
    return "High churn risk. Consider retention offers.";
  } else {
    return "Subscription is healthy. Continue monitoring.";
  }
}

function generateReasoning(health: SubscriptionHealthResult, subscription: any): string {
  let reasoning = `Subscription health: ${health.healthStatus} (${health.healthScore}/100). `;

  if (health.churnProbability && health.churnProbability > 30) {
    reasoning += `Churn probability: ${health.churnProbability}%. `;
  }

  if (health.usageTrend) {
    reasoning += `Usage trend: ${health.usageTrend}. `;
  }

  if (health.renewalLikelihood) {
    reasoning += `Renewal likelihood: ${health.renewalLikelihood}%. `;
  }

  return reasoning;
}
