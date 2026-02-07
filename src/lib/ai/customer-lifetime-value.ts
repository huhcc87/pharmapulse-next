// AI Customer Lifetime Value Prediction
// Predict customer churn, lifetime value, and recommend retention strategies

import { prisma } from "@/lib/prisma";

export interface CustomerLTVRequest {
  customerId: number;
  includeChurnPrediction?: boolean;
  includeRecommendations?: boolean;
}

export interface CustomerLTVResult {
  customerId: number;
  predictedLtv: number;
  currentLtv: number;
  ltvConfidence: number;
  churnRiskScore: number;
  churnProbability: number;
  predictedChurnDate?: Date;
  churnReason?: string;
  segment: "HIGH_VALUE" | "MEDIUM_VALUE" | "LOW_VALUE" | "AT_RISK" | "CHURNED";
  segmentReason?: string;
  avgOrderValue?: number;
  purchaseFrequency?: number;
  lastPurchaseDate?: Date;
  daysSinceLastPurchase?: number;
  retentionStrategy?: string;
  recommendedAction?: string;
  retentionScore?: number;
  crossSellOpportunities?: Array<{
    productId: number;
    productName: string;
    reason: string;
    confidence: number;
  }>;
  upsellOpportunities?: Array<{
    productId: number;
    productName: string;
    reason: string;
    confidence: number;
  }>;
  nextPurchaseDate?: Date;
  nextPurchaseValue?: number;
  nextPurchaseConfidence?: number;
  healthScore: number;
  healthFactors: string[];
  confidenceScore: number;
}

/**
 * Predict customer lifetime value and churn risk
 */
export async function predictCustomerLTV(
  request: CustomerLTVRequest,
  tenantId: number = 1
): Promise<CustomerLTVResult> {
  const { customerId, includeChurnPrediction = true, includeRecommendations = true } = request;

  // Get customer data
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      invoices: {
        include: {
          lineItems: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  // Calculate current LTV
  const currentLtv = calculateCurrentLTV(customer.invoices);

  // Calculate purchase behavior
  const purchaseBehavior = calculatePurchaseBehavior(customer.invoices);

  // Predict future LTV
  const predictedLtv = predictFutureLTV(purchaseBehavior, currentLtv);

  // Predict churn risk
  const churnPrediction = includeChurnPrediction
    ? await predictChurnRisk(customerId, purchaseBehavior, tenantId)
    : {
        churnRiskScore: 0,
        churnProbability: 0,
        predictedChurnDate: undefined,
        churnReason: undefined,
      };

  // Segment customer
  const segmentation = segmentCustomer(currentLtv, predictedLtv, churnPrediction.churnRiskScore);

  // Calculate customer health score
  const healthScore = calculateHealthScore({
    currentLtv,
    predictedLtv,
    churnRisk: churnPrediction.churnRiskScore,
    purchaseFrequency: purchaseBehavior.frequency,
    daysSinceLastPurchase: purchaseBehavior.daysSinceLastPurchase,
  });

  // Get retention strategy
  const retentionStrategy = includeRecommendations
    ? await getRetentionStrategy(segmentation.segment, churnPrediction.churnRiskScore, healthScore)
    : undefined;

  // Get cross-sell/upsell opportunities
  const opportunities = includeRecommendations
    ? await getCrossSellUpsellOpportunities(customerId, tenantId)
    : {
        crossSell: undefined,
        upsell: undefined,
      };

  // Predict next purchase
  const nextPurchase = predictNextPurchase(purchaseBehavior);

  // Calculate confidence score
  const confidenceScore = calculateConfidenceScore({
    dataPoints: customer.invoices.length,
    purchaseFrequency: purchaseBehavior.frequency,
    daysSinceLastPurchase: purchaseBehavior.daysSinceLastPurchase,
  });

  // Save to database
  await prisma.aICustomerLifetimeValue.create({
    data: {
      tenantId,
      customerId,
      predictedLtv: predictedLtv,
      currentLtv: currentLtv,
      ltvConfidence: confidenceScore,
      churnRiskScore: churnPrediction.churnRiskScore,
      churnProbability: churnPrediction.churnProbability,
      predictedChurnDate: churnPrediction.predictedChurnDate,
      churnReason: churnPrediction.churnReason,
      segment: segmentation.segment,
      segmentReason: segmentation.reason,
      avgOrderValue: purchaseBehavior.avgOrderValue,
      purchaseFrequency: purchaseBehavior.frequency,
      lastPurchaseDate: purchaseBehavior.lastPurchaseDate,
      daysSinceLastPurchase: purchaseBehavior.daysSinceLastPurchase,
      retentionStrategy: retentionStrategy?.strategy,
      recommendedAction: retentionStrategy?.action,
      retentionScore: retentionStrategy?.score,
      crossSellOpportunities: opportunities.crossSell,
      upsellOpportunities: opportunities.upsell,
      nextPurchaseDate: nextPurchase.date,
      nextPurchaseValue: nextPurchase.value,
      nextPurchaseConfidence: nextPurchase.confidence,
      healthScore,
      healthFactors: getHealthFactors(healthScore, churnPrediction.churnRiskScore, purchaseBehavior),
      dataPoints: customer.invoices.length,
      confidenceScore,
    },
  });

  return {
    customerId,
    predictedLtv,
    currentLtv,
    ltvConfidence: confidenceScore,
    churnRiskScore: churnPrediction.churnRiskScore,
    churnProbability: churnPrediction.churnProbability,
    predictedChurnDate: churnPrediction.predictedChurnDate,
    churnReason: churnPrediction.churnReason,
    segment: segmentation.segment,
    segmentReason: segmentation.reason,
    avgOrderValue: purchaseBehavior.avgOrderValue,
    purchaseFrequency: purchaseBehavior.frequency,
    lastPurchaseDate: purchaseBehavior.lastPurchaseDate,
    daysSinceLastPurchase: purchaseBehavior.daysSinceLastPurchase,
    retentionStrategy: retentionStrategy?.strategy,
    recommendedAction: retentionStrategy?.action,
    retentionScore: retentionStrategy?.score,
    crossSellOpportunities: opportunities.crossSell,
    upsellOpportunities: opportunities.upsell,
    nextPurchaseDate: nextPurchase.date,
    nextPurchaseValue: nextPurchase.value,
    nextPurchaseConfidence: nextPurchase.confidence,
    healthScore,
    healthFactors: getHealthFactors(healthScore, churnPrediction.churnRiskScore, purchaseBehavior),
    confidenceScore,
  };
}

/**
 * Calculate current lifetime value
 */
function calculateCurrentLTV(invoices: any[]): number {
  if (invoices.length === 0) return 0;

  return invoices.reduce((sum, inv) => {
    const total = Number(inv.totalAmountPaise || 0) / 100;
    return sum + total;
  }, 0);
}

/**
 * Calculate purchase behavior
 */
function calculatePurchaseBehavior(invoices: any[]): {
  avgOrderValue: number;
  frequency: number; // Orders per month
  lastPurchaseDate?: Date;
  daysSinceLastPurchase?: number;
} {
  if (invoices.length === 0) {
    return {
      avgOrderValue: 0,
      frequency: 0,
    };
  }

  const totalValue = invoices.reduce((sum, inv) => {
    return sum + Number(inv.totalAmountPaise || 0) / 100;
  }, 0);

  const avgOrderValue = totalValue / invoices.length;

  // Calculate frequency (orders per month)
  const firstPurchase = new Date(invoices[invoices.length - 1].createdAt);
  const lastPurchase = new Date(invoices[0].createdAt);
  const daysDiff = (lastPurchase.getTime() - firstPurchase.getTime()) / (1000 * 60 * 60 * 24);
  const monthsDiff = daysDiff / 30;
  const frequency = monthsDiff > 0 ? invoices.length / monthsDiff : invoices.length;

  // Days since last purchase
  const now = new Date();
  const daysSinceLastPurchase = Math.floor(
    (now.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    avgOrderValue,
    frequency,
    lastPurchaseDate: lastPurchase,
    daysSinceLastPurchase,
  };
}

/**
 * Predict future lifetime value
 */
function predictFutureLTV(
  purchaseBehavior: ReturnType<typeof calculatePurchaseBehavior>,
  currentLtv: number
): number {
  if (purchaseBehavior.frequency === 0) return currentLtv;

  // Simple prediction: assume customer continues for 2 years
  const monthsRemaining = 24;
  const predictedMonthlyValue = purchaseBehavior.avgOrderValue * purchaseBehavior.frequency;
  const predictedFutureValue = predictedMonthlyValue * monthsRemaining;

  return currentLtv + predictedFutureValue;
}

/**
 * Predict churn risk
 */
async function predictChurnRisk(
  customerId: number,
  purchaseBehavior: ReturnType<typeof calculatePurchaseBehavior>,
  tenantId: number
): Promise<{
  churnRiskScore: number;
  churnProbability: number;
  predictedChurnDate?: Date;
  churnReason?: string;
}> {
  let churnRiskScore = 0;
  const reasons: string[] = [];

  // Factor 1: Days since last purchase
  if (purchaseBehavior.daysSinceLastPurchase) {
    if (purchaseBehavior.daysSinceLastPurchase > 90) {
      churnRiskScore += 40;
      reasons.push("No purchase in last 90 days");
    } else if (purchaseBehavior.daysSinceLastPurchase > 60) {
      churnRiskScore += 25;
      reasons.push("No purchase in last 60 days");
    } else if (purchaseBehavior.daysSinceLastPurchase > 30) {
      churnRiskScore += 10;
      reasons.push("No purchase in last 30 days");
    }
  }

  // Factor 2: Purchase frequency decline
  if (purchaseBehavior.frequency < 0.5) {
    churnRiskScore += 20;
    reasons.push("Low purchase frequency");
  }

  // Factor 3: Low order value
  if (purchaseBehavior.avgOrderValue && purchaseBehavior.avgOrderValue < 500) {
    churnRiskScore += 10;
    reasons.push("Low average order value");
  }

  // Calculate churn probability
  const churnProbability = Math.min(100, churnRiskScore);

  // Predict churn date (if high risk)
  let predictedChurnDate: Date | undefined;
  if (churnRiskScore > 50) {
    const daysUntilChurn = purchaseBehavior.daysSinceLastPurchase
      ? purchaseBehavior.daysSinceLastPurchase + 30
      : 90;
    predictedChurnDate = new Date();
    predictedChurnDate.setDate(predictedChurnDate.getDate() + daysUntilChurn);
  }

  return {
    churnRiskScore,
    churnProbability,
    predictedChurnDate,
    churnReason: reasons.length > 0 ? reasons.join("; ") : undefined,
  };
}

/**
 * Segment customer
 */
function segmentCustomer(
  currentLtv: number,
  predictedLtv: number,
  churnRiskScore: number
): {
  segment: "HIGH_VALUE" | "MEDIUM_VALUE" | "LOW_VALUE" | "AT_RISK" | "CHURNED";
  reason?: string;
} {
  if (churnRiskScore > 70) {
    return {
      segment: "AT_RISK",
      reason: "High churn risk detected",
    };
  }

  if (predictedLtv > 50000) {
    return {
      segment: "HIGH_VALUE",
      reason: "Predicted LTV above ₹50,000",
    };
  } else if (predictedLtv > 20000) {
    return {
      segment: "MEDIUM_VALUE",
      reason: "Predicted LTV between ₹20,000 - ₹50,000",
    };
  } else {
    return {
      segment: "LOW_VALUE",
      reason: "Predicted LTV below ₹20,000",
    };
  }
}

/**
 * Calculate customer health score
 */
function calculateHealthScore(data: {
  currentLtv: number;
  predictedLtv: number;
  churnRisk: number;
  purchaseFrequency?: number;
  daysSinceLastPurchase?: number;
}): number {
  let score = 50; // Base score

  // LTV factor
  if (data.predictedLtv > 50000) score += 20;
  else if (data.predictedLtv > 20000) score += 10;

  // Churn risk factor (inverse)
  score -= data.churnRisk * 0.3;

  // Purchase frequency factor
  if (data.purchaseFrequency && data.purchaseFrequency > 2) score += 15;
  else if (data.purchaseFrequency && data.purchaseFrequency > 1) score += 10;

  // Recency factor
  if (data.daysSinceLastPurchase) {
    if (data.daysSinceLastPurchase < 30) score += 15;
    else if (data.daysSinceLastPurchase < 60) score += 5;
    else score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Get retention strategy
 */
async function getRetentionStrategy(
  segment: string,
  churnRiskScore: number,
  healthScore: number
): Promise<{
  strategy?: string;
  action?: string;
  score?: number;
}> {
  if (churnRiskScore > 70) {
    return {
      strategy: "OUTREACH",
      action: "Immediate customer outreach required - high churn risk",
      score: 90,
    };
  }

  if (segment === "HIGH_VALUE" && healthScore < 70) {
    return {
      strategy: "PERSONALIZED",
      action: "Personalized offers and loyalty program enrollment",
      score: 80,
    };
  }

  if (segment === "MEDIUM_VALUE") {
    return {
      strategy: "LOYALTY",
      action: "Loyalty program and periodic discounts",
      score: 70,
    };
  }

  return {
    strategy: "DISCOUNT",
    action: "Periodic discounts and promotions",
    score: 60,
  };
}

/**
 * Get cross-sell/upsell opportunities
 */
async function getCrossSellUpsellOpportunities(
  customerId: number,
  tenantId: number
): Promise<{
  crossSell?: Array<{ productId: number; productName: string; reason: string; confidence: number }>;
  upsell?: Array<{ productId: number; productName: string; reason: string; confidence: number }>;
}> {
  // This would integrate with product recommendation system
  // For now, return empty
  return {
    crossSell: undefined,
    upsell: undefined,
  };
}

/**
 * Predict next purchase
 */
function predictNextPurchase(
  purchaseBehavior: ReturnType<typeof calculatePurchaseBehavior>
): {
  date?: Date;
  value?: number;
  confidence?: number;
} {
  if (!purchaseBehavior.frequency || purchaseBehavior.frequency === 0) {
    return {};
  }

  // Predict next purchase based on frequency
  const daysUntilNextPurchase = 30 / purchaseBehavior.frequency;
  const nextPurchaseDate = new Date();
  nextPurchaseDate.setDate(nextPurchaseDate.getDate() + daysUntilNextPurchase);

  return {
    date: nextPurchaseDate,
    value: purchaseBehavior.avgOrderValue,
    confidence: purchaseBehavior.frequency > 1 ? 70 : 50,
  };
}

/**
 * Calculate confidence score
 */
function calculateConfidenceScore(data: {
  dataPoints: number;
  purchaseFrequency?: number;
  daysSinceLastPurchase?: number;
}): number {
  let score = 50;

  // More data points = higher confidence
  score += Math.min(30, data.dataPoints * 2);

  // Higher frequency = higher confidence
  if (data.purchaseFrequency && data.purchaseFrequency > 1) {
    score += 10;
  }

  // Recent purchase = higher confidence
  if (data.daysSinceLastPurchase && data.daysSinceLastPurchase < 30) {
    score += 10;
  }

  return Math.min(100, score);
}

/**
 * Get health factors
 */
function getHealthFactors(
  healthScore: number,
  churnRiskScore: number,
  purchaseBehavior: ReturnType<typeof calculatePurchaseBehavior>
): string[] {
  const factors: string[] = [];

  if (healthScore > 80) {
    factors.push("High customer health");
  } else if (healthScore < 50) {
    factors.push("Low customer health");
  }

  if (churnRiskScore > 50) {
    factors.push("High churn risk");
  }

  if (purchaseBehavior.frequency && purchaseBehavior.frequency > 2) {
    factors.push("High purchase frequency");
  } else if (purchaseBehavior.frequency && purchaseBehavior.frequency < 0.5) {
    factors.push("Low purchase frequency");
  }

  if (purchaseBehavior.daysSinceLastPurchase && purchaseBehavior.daysSinceLastPurchase > 60) {
    factors.push("Long time since last purchase");
  }

  return factors;
}
