// AI Fraud Detection System
// Transaction anomalies, insurance fraud, duplicate detection
// Optimized for Indian pharmacy market

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface FraudDetectionResult {
  fraudRiskScore: number; // 0-100
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  amountAnomaly: boolean;
  timeAnomaly: boolean;
  patternAnomaly: boolean;
  isDuplicate: boolean;
  isInflated: boolean;
  isInsuranceFraud: boolean;
  isPaymentFraud: boolean;
  customerRiskScore?: number;
  customerRiskLevel?: string;
  fraudIndicators?: string[];
  fraudReason?: string;
}

/**
 * Detect fraud in invoice/transaction
 * Checks: amount anomalies, timing, patterns, duplicates, insurance fraud
 */
export async function detectFraud(
  invoiceId: number,
  tenantId: number = 1
): Promise<FraudDetectionResult> {
  try {
    const result: FraudDetectionResult = {
      fraudRiskScore: 0,
      riskLevel: "LOW",
      amountAnomaly: false,
      timeAnomaly: false,
      patternAnomaly: false,
      isDuplicate: false,
      isInflated: false,
      isInsuranceFraud: false,
      isPaymentFraud: false,
      fraudIndicators: [],
    };

    // Fetch invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        lineItems: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    // 1. Amount Anomaly Detection
    const amountAnalysis = analyzeAmountAnomaly(invoice, tenantId);
    result.amountAnomaly = amountAnalysis.isAnomaly;
    if (amountAnalysis.isAnomaly) {
      result.fraudRiskScore += 30;
      result.fraudIndicators?.push(
        `Unusual transaction amount: ₹${(invoice.totalInvoicePaise / 100).toFixed(2)}`
      );
      result.isInflated = amountAnalysis.isInflated || false;
    }

    // 2. Time Anomaly Detection
    const timeAnalysis = analyzeTimeAnomaly(invoice, tenantId);
    result.timeAnomaly = timeAnalysis.isAnomaly;
    if (timeAnalysis.isAnomaly) {
      result.fraudRiskScore += 20;
      result.fraudIndicators?.push("Transaction at unusual time");
    }

    // 3. Pattern Anomaly Detection
    const patternAnalysis = await analyzePatternAnomaly(invoice, tenantId);
    result.patternAnomaly = patternAnalysis.isAnomaly;
    if (patternAnalysis.isAnomaly) {
      result.fraudRiskScore += 25;
      result.fraudIndicators?.push(patternAnalysis.reason || "Unusual purchase pattern");
    }

    // 4. Duplicate Detection
    const duplicateCheck = await checkDuplicateInvoice(invoice, tenantId);
    result.isDuplicate = duplicateCheck.isDuplicate;
    if (duplicateCheck.isDuplicate) {
      result.fraudRiskScore += 40;
      result.fraudIndicators?.push(`Similar invoice found: #${duplicateCheck.duplicateInvoiceId}`);
    }

    // 5. Insurance Fraud Detection
    if (invoice.paymentMethod === "INSURANCE" || invoice.buyerGstin) {
      const insuranceCheck = await checkInsuranceFraud(invoice, tenantId);
      result.isInsuranceFraud = insuranceCheck.isFraud;
      if (insuranceCheck.isFraud) {
        result.fraudRiskScore += 35;
        result.fraudIndicators?.push(insuranceCheck.reason || "Suspicious insurance claim pattern");
      }
    }

    // 6. Payment Fraud Detection
    if (invoice.payments && invoice.payments.length > 0) {
      const paymentCheck = checkPaymentFraud(invoice.payments);
      result.isPaymentFraud = paymentCheck.isFraud;
      if (paymentCheck.isFraud) {
        result.fraudRiskScore += 30;
        result.fraudIndicators?.push(paymentCheck.reason || "Suspicious payment pattern");
      }
    }

    // 7. Customer Risk Scoring
    if (invoice.customerId) {
      const customerRisk = await calculateCustomerRiskScore(invoice.customerId, tenantId);
      result.customerRiskScore = customerRisk.score;
      result.customerRiskLevel = customerRisk.level;

      if (customerRisk.score >= 70) {
        result.fraudRiskScore += 15;
      }
    }

    // Determine overall risk level
    if (result.fraudRiskScore >= 80) {
      result.riskLevel = "CRITICAL";
    } else if (result.fraudRiskScore >= 60) {
      result.riskLevel = "HIGH";
    } else if (result.fraudRiskScore >= 40) {
      result.riskLevel = "MEDIUM";
    }

    // Generate fraud reason
    if (result.fraudRiskScore > 0) {
      result.fraudReason = `Fraud risk score: ${result.fraudRiskScore}/100. Indicators: ${result.fraudIndicators?.join(
        ", "
      )}`;
    }

    return result;
  } catch (error: any) {
    console.error("Fraud detection error:", error);
    throw error;
  }
}

// Helper functions

function analyzeAmountAnomaly(
  invoice: any,
  _tenantId: number
): {
  isAnomaly: boolean;
  isInflated?: boolean;
} {
  const amount = invoice.totalInvoicePaise / 100; // rupees

  const isLarge = amount > 5000;
  const isVeryLarge = amount > 10000;

  return {
    isAnomaly: isLarge,
    isInflated: isVeryLarge,
  };
}

function analyzeTimeAnomaly(
  invoice: any,
  _tenantId: number
): {
  isAnomaly: boolean;
} {
  const invoiceDate = new Date(invoice.invoiceDate);
  const hour = invoiceDate.getHours();

  const isAnomalous = hour < 8 || hour > 22;

  return { isAnomaly: isAnomalous };
}

async function analyzePatternAnomaly(
  invoice: any,
  tenantId: number
): Promise<{
  isAnomaly: boolean;
  reason?: string;
}> {
  if (!invoice.customerId) return { isAnomaly: false };

  const oneHourAgo = new Date(new Date(invoice.invoiceDate).getTime() - 60 * 60 * 1000);

  const recentInvoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      customerId: invoice.customerId,
      invoiceDate: {
        gte: oneHourAgo,
        lt: invoice.invoiceDate,
      },
    },
  });

  if (recentInvoices.length >= 3) {
    return {
      isAnomaly: true,
      reason: `Customer made ${recentInvoices.length + 1} transactions within 1 hour`,
    };
  }

  if (invoice.lineItems && invoice.lineItems.length > 0) {
    const highQuantity = invoice.lineItems.some((item: any) => item.quantity > 100);
    if (highQuantity) {
      return { isAnomaly: true, reason: "Unusual quantity purchased (>100 units)" };
    }
  }

  return { isAnomaly: false };
}

async function checkDuplicateInvoice(
  invoice: any,
  tenantId: number
): Promise<{
  isDuplicate: boolean;
  duplicateInvoiceId?: number;
}> {
  if (!invoice.customerId) return { isDuplicate: false };

  const oneDayAgo = new Date(new Date(invoice.invoiceDate).getTime() - 24 * 60 * 60 * 1000);

  const similarInvoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      customerId: invoice.customerId,
      id: { not: invoice.id },
      invoiceDate: {
        gte: oneDayAgo,
        lte: invoice.invoiceDate,
      },
      totalInvoicePaise: {
        gte: Math.round(invoice.totalInvoicePaise * 0.95),
        lte: Math.round(invoice.totalInvoicePaise * 1.05),
      },
    },
  });

  if (similarInvoices.length > 0) {
    return { isDuplicate: true, duplicateInvoiceId: similarInvoices[0].id };
  }

  return { isDuplicate: false };
}

async function checkInsuranceFraud(
  invoice: any,
  tenantId: number
): Promise<{
  isFraud: boolean;
  reason?: string;
}> {
  if (!invoice.customerId) return { isFraud: false };

  const thirtyDaysAgo = new Date(new Date(invoice.invoiceDate).getTime() - 30 * 24 * 60 * 60 * 1000);

  const insuranceClaims = await prisma.invoice.findMany({
    where: {
      tenantId,
      customerId: invoice.customerId,
      paymentMethod: "INSURANCE",
      invoiceDate: { gte: thirtyDaysAgo },
      totalInvoicePaise: { gt: 500000 }, // >₹5000
    },
  });

  if (insuranceClaims.length >= 3) {
    return {
      isFraud: true,
      reason: `Customer has ${insuranceClaims.length + 1} high-value insurance claims in 30 days`,
    };
  }

  return { isFraud: false };
}

function checkPaymentFraud(payments: any[]): { isFraud: boolean; reason?: string } {
  if (payments.length > 3) {
    return {
      isFraud: true,
      reason: "Too many payment methods for single invoice (possible split payment fraud)",
    };
  }

  const hasFailedUPI = payments.some((p) => p.method === "UPI" && p.status === "FAILED");
  const firstCreatedAt = payments[0]?.createdAt ? new Date(payments[0].createdAt) : null;

  const hasCashAfterFailure = payments.some((p) => {
    if (p.method !== "CASH") return false;
    if (!firstCreatedAt) return false;
    return new Date(p.createdAt) > firstCreatedAt;
  });

  if (hasFailedUPI && hasCashAfterFailure) {
    return {
      isFraud: true,
      reason: "Failed UPI payment followed by cash payment (possible chargeback fraud)",
    };
  }

  return { isFraud: false };
}

async function calculateCustomerRiskScore(
  customerId: number,
  tenantId: number
): Promise<{ score: number; level: string }> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      creditNotes: {
        where: {
          reason: { in: ["DAMAGED", "WRONG_ITEM", "QUALITY_ISSUE"] },
        },
      },
      invoices: {
        take: 50,
        orderBy: { invoiceDate: "desc" },
      },
    },
  });

  // ✅ Guard: avoids "customer is possibly null"
  if (!customer) {
    return { score: 0, level: "LOW" };
  }

  let riskScore = 0;

  // High number of returns = risky
  if (customer.creditNotes && customer.creditNotes.length > 5) {
    riskScore += 30;
  }

  // Frequent small transactions (possible fraud)
  const invoiceCount = customer.invoices ? customer.invoices.length : 0;

  if (invoiceCount > 20) {
    const totalPaise = (customer.invoices || []).reduce(
      (sum: number, inv: any) => sum + (inv.totalInvoicePaise || 0),
      0
    );

    const avgAmountPaise = invoiceCount > 0 ? totalPaise / invoiceCount : 0;

    if (avgAmountPaise < 20000) {
      // <₹200 average
      riskScore += 20;
    }
  }

  let level = "LOW";
  if (riskScore >= 70) level = "HIGH";
  else if (riskScore >= 40) level = "MEDIUM";

  return { score: Math.min(100, riskScore), level };
}
