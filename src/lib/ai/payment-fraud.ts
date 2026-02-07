// AI Payment Fraud Detection
// Payment anomaly detection, chargeback prediction, risk scoring

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface PaymentRiskResult {
  riskScore: number; // 0-100
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  isFraudulent: boolean;
  fraudIndicators?: Array<{
    type: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    description: string;
  }>;
  chargebackProbability?: number; // 0-100
  chargebackRiskFactors?: string[];
  recommendation?: string;
  reasoning?: string;
}

/**
 * Analyze payment for fraud risk
 */
export async function analyzePaymentRisk(
  tenantId: string,
  paymentId: string
): Promise<PaymentRiskResult> {
  try {
    const result: PaymentRiskResult = {
      riskScore: 0,
      riskLevel: "LOW",
      isFraudulent: false,
    };

    // Get payment
    const payment = await prisma.billingPayment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: {
          include: {
            customer: true,
          },
        },
      },
    });

    if (!payment) {
      throw new Error("Payment not found");
    }

    // Analyze payment
    const fraudIndicators = await detectFraudIndicators(tenantId, payment);
    result.fraudIndicators = fraudIndicators;

    // Calculate risk score
    result.riskScore = calculateRiskScore(fraudIndicators);

    // Determine risk level
    if (result.riskScore >= 80) {
      result.riskLevel = "CRITICAL";
      result.isFraudulent = true;
    } else if (result.riskScore >= 60) {
      result.riskLevel = "HIGH";
      result.isFraudulent = true;
    } else if (result.riskScore >= 40) {
      result.riskLevel = "MEDIUM";
    } else {
      result.riskLevel = "LOW";
    }

    // Chargeback prediction
    const chargebackPrediction = await predictChargeback(tenantId, payment);
    result.chargebackProbability = chargebackPrediction.probability;
    result.chargebackRiskFactors = chargebackPrediction.riskFactors;

    // Generate recommendation
    result.recommendation = generateRecommendation(result);
    result.reasoning = generateReasoning(result, payment);

    return result;
  } catch (error: any) {
    console.error("Payment fraud detection error:", error);
    throw error;
  }
}

async function detectFraudIndicators(
  tenantId: string,
  payment: any
): Promise<Array<{
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
}>> {
  const indicators: Array<{
    type: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    description: string;
  }> = [];

  // Check for unusual amount
  const avgPayment = await getAveragePayment(tenantId);
  if (avgPayment > 0) {
    const paymentAmount = payment.amountPaise || 0;
    if (paymentAmount > avgPayment * 3) {
      indicators.push({
        type: "UNUSUAL_AMOUNT",
        severity: "MEDIUM",
        description: `Payment amount (₹${(paymentAmount / 100).toFixed(2)}) is 3x higher than average (₹${(avgPayment / 100).toFixed(2)})`,
      });
    }
  }

  // Check for multiple failed attempts
  const failedAttempts = await prisma.billingPayment.count({
    where: {
      tenantId,
      status: "FAILED",
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      },
    },
  });

  if (failedAttempts > 5) {
    indicators.push({
      type: "MULTIPLE_FAILED_ATTEMPTS",
      severity: "HIGH",
      description: `${failedAttempts} failed payment attempts in the last 24 hours`,
    });
  }

  // Check for rapid payments
  const recentPayments = await prisma.billingPayment.count({
    where: {
      tenantId,
      status: "SUCCESS",
      createdAt: {
        gte: new Date(Date.now() - 1 * 60 * 60 * 1000), // Last 1 hour
      },
    },
  });

  if (recentPayments > 10) {
    indicators.push({
      type: "RAPID_PAYMENTS",
      severity: "MEDIUM",
      description: `${recentPayments} successful payments in the last hour`,
    });
  }

  // Check payment method
  if (payment.paymentMethod === "CARD" && !payment.cardLast4) {
    indicators.push({
      type: "INCOMPLETE_CARD_INFO",
      severity: "LOW",
      description: "Card information incomplete",
    });
  }

  // Check for new customer with high amount
  if (payment.invoice?.customer) {
    const customerAge = new Date().getTime() - new Date(payment.invoice.customer.createdAt).getTime();
    const daysSinceCreation = customerAge / (1000 * 60 * 60 * 24);
    
    if (daysSinceCreation < 1 && (payment.amountPaise || 0) > 100000) {
      indicators.push({
        type: "NEW_CUSTOMER_HIGH_AMOUNT",
        severity: "HIGH",
        description: "New customer making high-value payment",
      });
    }
  }

  return indicators;
}

function calculateRiskScore(
  indicators: Array<{
    type: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    description: string;
  }>
): number {
  let score = 0;

  for (const indicator of indicators) {
    if (indicator.severity === "HIGH") {
      score += 30;
    } else if (indicator.severity === "MEDIUM") {
      score += 15;
    } else {
      score += 5;
    }
  }

  return Math.min(100, score);
}

async function getAveragePayment(tenantId: string): Promise<number> {
  const payments = await prisma.billingPayment.findMany({
    where: {
      tenantId,
      status: "SUCCESS",
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    },
    take: 100,
  });

  if (payments.length === 0) {
    return 0;
  }

  const total = payments.reduce((sum, p) => sum + (p.amountPaise || 0), 0);
  return total / payments.length;
}

async function predictChargeback(
  tenantId: string,
  payment: any
): Promise<{
  probability: number;
  riskFactors: string[];
}> {
  const riskFactors: string[] = [];
  let probability = 0;

  // Check for chargeback history
  const chargebackHistory = await prisma.billingPayment.count({
    where: {
      tenantId,
      status: "CHARGEBACK",
    },
  });

  if (chargebackHistory > 0) {
    probability += 20;
    riskFactors.push("Previous chargeback history");
  }

  // Check payment amount
  const paymentAmount = payment.amountPaise || 0;
  if (paymentAmount > 500000) { // ₹5,000
    probability += 15;
    riskFactors.push("High payment amount");
  }

  // Check payment method
  if (payment.paymentMethod === "CARD") {
    probability += 10;
    riskFactors.push("Card payment (higher chargeback risk)");
  }

  // Check for refund requests
  const refundRequests = await prisma.billingPayment.count({
    where: {
      tenantId,
      status: "REFUNDED",
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    },
  });

  if (refundRequests > 3) {
    probability += 25;
    riskFactors.push("Multiple recent refunds");
  }

  return {
    probability: Math.min(100, probability),
    riskFactors,
  };
}

function generateRecommendation(result: PaymentRiskResult): string {
  if (result.riskLevel === "CRITICAL" || result.riskLevel === "HIGH") {
    return "Review payment manually. Consider requiring additional verification.";
  } else if (result.riskLevel === "MEDIUM") {
    return "Monitor payment closely. Consider additional verification for future payments.";
  } else {
    return "Payment appears safe. No action required.";
  }
}

function generateReasoning(result: PaymentRiskResult, payment: any): string {
  let reasoning = `Payment risk analysis: ${result.riskLevel} risk (${result.riskScore}/100). `;

  if (result.fraudIndicators && result.fraudIndicators.length > 0) {
    reasoning += `Found ${result.fraudIndicators.length} fraud indicator(s). `;
  }

  if (result.chargebackProbability && result.chargebackProbability > 30) {
    reasoning += `Chargeback probability: ${result.chargebackProbability}%. `;
  }

  return reasoning;
}
