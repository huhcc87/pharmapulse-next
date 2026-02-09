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

function toStr(value: string | number, label: string): string {
  const s = String(value ?? "").trim();
  if (!s) throw new Error(`Invalid ${label}`);
  return s;
}

function toFiniteNumberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Analyze payment for fraud risk
 */
export async function analyzePaymentRisk(
  tenantId: string | number,
  paymentId: string
): Promise<PaymentRiskResult> {
  try {
    const tenantIdStr = toStr(tenantId, "tenantId");

    const result: PaymentRiskResult = {
      riskScore: 0,
      riskLevel: "LOW",
      isFraudulent: false,
    };

    // ✅ IMPORTANT FIX:
    // Your schema supports `invoices` relation (plural).
    // But BillingInvoice does NOT have `customer` relation field (per error),
    // so we include invoices only (no nested include).
    const payment = await prisma.billingPayment.findUnique({
      where: { id: paymentId },
      include: {
        invoices: true,
      },
    });

    if (!payment) throw new Error("Payment not found");

    // Analyze payment
    const fraudIndicators = await detectFraudIndicators(tenantIdStr, payment as any);
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
    const chargebackPrediction = await predictChargeback(tenantIdStr);
    result.chargebackProbability = chargebackPrediction.probability;
    result.chargebackRiskFactors = chargebackPrediction.riskFactors;

    // Generate recommendation
    result.recommendation = generateRecommendation(result);
    result.reasoning = generateReasoning(result);

    return result;
  } catch (error: any) {
    console.error("Payment fraud detection error:", error);
    throw error;
  }
}

async function detectFraudIndicators(
  tenantId: string,
  payment: any
): Promise<
  Array<{
    type: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    description: string;
  }>
> {
  const indicators: Array<{
    type: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    description: string;
  }> = [];

  // 1) Unusual amount vs average (tenant-level)
  const avgPayment = await getAveragePayment(tenantId);
  const paymentAmount = payment.amountPaise || 0;

  if (avgPayment > 0 && paymentAmount > avgPayment * 3) {
    indicators.push({
      type: "UNUSUAL_AMOUNT",
      severity: "MEDIUM",
      description: `Payment amount (₹${(paymentAmount / 100).toFixed(
        2
      )}) is 3x higher than average (₹${(avgPayment / 100).toFixed(2)})`,
    });
  }

  // 2) Multiple failed attempts in last 24h (tenant-level)
  const failedAttempts = await prisma.billingPayment.count({
    where: {
      tenantId,
      status: "FAILED",
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  if (failedAttempts > 5) {
    indicators.push({
      type: "MULTIPLE_FAILED_ATTEMPTS",
      severity: "HIGH",
      description: `${failedAttempts} failed payment attempts in the last 24 hours`,
    });
  }

  // 3) Rapid successful payments in last 1h (tenant-level)
  const recentPayments = await prisma.billingPayment.count({
    where: {
      tenantId,
      status: "SUCCESS",
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });

  if (recentPayments > 10) {
    indicators.push({
      type: "RAPID_PAYMENTS",
      severity: "MEDIUM",
      description: `${recentPayments} successful payments in the last hour`,
    });
  }

  // 4) Card sanity check
  if (payment.paymentMethod === "CARD" && !payment.cardLast4) {
    indicators.push({
      type: "INCOMPLETE_CARD_INFO",
      severity: "LOW",
      description: "Card information incomplete",
    });
  }

  // 5) New customer + high amount (BEST-EFFORT, schema-safe)
  // We can’t rely on invoices.customer relation. We’ll:
  // - look for invoices[0].customerId if present
  // - if numeric, fetch prisma.customer.createdAt
  const firstInvoice = Array.isArray(payment.invoices) ? payment.invoices[0] : null;
  const customerIdMaybe = firstInvoice?.customerId;
  const customerIdNum = toFiniteNumberOrNull(customerIdMaybe);

  if (customerIdNum && paymentAmount > 100000) {
    // ₹1,000+
    const customer = await prisma.customer.findUnique({
      where: { id: customerIdNum },
      select: { createdAt: true },
    });

    if (customer?.createdAt) {
      const customerAgeDays =
        (Date.now() - new Date(customer.createdAt).getTime()) / (1000 * 60 * 60 * 24);

      if (customerAgeDays < 1) {
        indicators.push({
          type: "NEW_CUSTOMER_HIGH_AMOUNT",
          severity: "HIGH",
          description: "New customer making high-value payment",
        });
      }
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
    if (indicator.severity === "HIGH") score += 30;
    else if (indicator.severity === "MEDIUM") score += 15;
    else score += 5;
  }

  return Math.min(100, score);
}

async function getAveragePayment(tenantId: string): Promise<number> {
  const payments = await prisma.billingPayment.findMany({
    where: {
      tenantId,
      status: "SUCCESS",
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    take: 100,
    select: { amountPaise: true },
  });

  if (payments.length === 0) return 0;

  const total = payments.reduce((sum, p) => sum + (p.amountPaise || 0), 0);
  return total / payments.length;
}

async function predictChargeback(
  tenantId: string
): Promise<{ probability: number; riskFactors: string[] }> {
  const riskFactors: string[] = [];
  let probability = 0;

  // Chargeback history (tenant-level)
  const chargebackHistory = await prisma.billingPayment.count({
    where: { tenantId, status: "CHARGEBACK" },
  });

  if (chargebackHistory > 0) {
    probability += 20;
    riskFactors.push("Previous chargeback history");
  }

  // Multiple recent refunds (tenant-level)
  const refundRequests = await prisma.billingPayment.count({
    where: {
      tenantId,
      status: "REFUNDED",
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  if (refundRequests > 3) {
    probability += 25;
    riskFactors.push("Multiple recent refunds");
  }

  return { probability: Math.min(100, probability), riskFactors };
}

function generateRecommendation(result: PaymentRiskResult): string {
  if (result.riskLevel === "CRITICAL" || result.riskLevel === "HIGH") {
    return "Review payment manually. Consider requiring additional verification.";
  }
  if (result.riskLevel === "MEDIUM") {
    return "Monitor payment closely. Consider additional verification for future payments.";
  }
  return "Payment appears safe. No action required.";
}

function generateReasoning(result: PaymentRiskResult): string {
  let reasoning = `Payment risk analysis: ${result.riskLevel} risk (${result.riskScore}/100). `;
  const indicatorCount = result.fraudIndicators?.length || 0;
  if (indicatorCount > 0) reasoning += `Found ${indicatorCount} fraud indicator(s). `;
  if ((result.chargebackProbability || 0) > 30) {
    reasoning += `Chargeback probability: ${result.chargebackProbability}%. `;
  }
  return reasoning;
}
