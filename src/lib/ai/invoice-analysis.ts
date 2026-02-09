// AI Invoice Analysis & Categorization
// Automatic categorization, duplicate detection, summarization

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface InvoiceAnalysisResult {
  category?: string;
  subcategory?: string;
  isAnomaly: boolean;
  anomalyType?: "DUPLICATE" | "INFLATED" | "UNUSUAL_AMOUNT";
  anomalyScore?: number;
  isDuplicate: boolean;
  duplicateInvoiceIds?: number[];
  similarityScore?: number;
  summary?: string;
  keyPoints?: string[];
  searchKeywords?: string[];
}

function toInt(value: string | number, label: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid ${label}`);
  return n;
}

/** Pick the best invoice timestamp available in your schema */
function invoiceTimestamp(invoice: any): Date {
  return new Date(invoice.invoiceDate ?? invoice.createdAt ?? Date.now());
}

/** Safely read total invoice amount in paise (your codebase uses totalInvoicePaise) */
function invoiceTotalPaise(invoice: any): number {
  const v = invoice.totalInvoicePaise ?? invoice.totalAmount ?? 0; // fallback just in case
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * Analyze invoice
 */
export async function analyzeInvoice(
  tenantId: string | number,
  invoiceId: string | number
): Promise<InvoiceAnalysisResult> {
  try {
    const result: InvoiceAnalysisResult = {
      isAnomaly: false,
      isDuplicate: false,
    };

    const tenantIdNum = toInt(tenantId, "tenantId");
    const invoiceIdNum = toInt(invoiceId, "invoiceId");

    // Get invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceIdNum },
      include: {
        lineItems: true,
        customer: true,
      },
    });

    if (!invoice) throw new Error("Invoice not found");

    // Categorize invoice
    const category = categorizeInvoice(invoice);
    result.category = category.category;
    result.subcategory = category.subcategory;

    // Check for duplicates
    const duplicateCheck = await checkForDuplicates(tenantIdNum, invoice);
    if (duplicateCheck.isDuplicate) {
      result.isDuplicate = true;
      result.duplicateInvoiceIds = duplicateCheck.duplicateIds;
      result.similarityScore = duplicateCheck.similarityScore;
      result.isAnomaly = true;
      result.anomalyType = "DUPLICATE";
      result.anomalyScore = duplicateCheck.similarityScore;
    }

    // Check for anomalies
    const anomalyCheck = await checkForAnomalies(tenantIdNum, invoice);
    if (anomalyCheck.isAnomaly) {
      result.isAnomaly = true;
      result.anomalyType = anomalyCheck.anomalyType;
      result.anomalyScore = anomalyCheck.anomalyScore;
    }

    // Generate summary
    result.summary = generateSummary(invoice);
    result.keyPoints = extractKeyPoints(invoice);
    result.searchKeywords = extractSearchKeywords(invoice);

    return result;
  } catch (error: any) {
    console.error("Invoice analysis error:", error);
    throw error;
  }
}

function categorizeInvoice(invoice: any): {
  category: string;
  subcategory?: string;
} {
  const lineItems = invoice.lineItems || [];

  if (invoice.customer?.email?.includes("@pharmapulse")) {
    return { category: "SUBSCRIPTION", subcategory: "RENEWAL" };
  }

  if (lineItems.some((item: any) => item.productName?.toLowerCase().includes("credit"))) {
    return { category: "CREDITS", subcategory: "TOP_UP" };
  }

  if (lineItems.some((item: any) => item.productName?.toLowerCase().includes("addon"))) {
    return { category: "ADDONS", subcategory: "FEATURE" };
  }

  return { category: "OTHER", subcategory: "GENERAL" };
}

async function checkForDuplicates(
  tenantId: number,
  invoice: any
): Promise<{
  isDuplicate: boolean;
  duplicateIds: number[];
  similarityScore: number;
}> {
  const t0 = invoiceTimestamp(invoice);
  const sevenDaysAgo = new Date(t0.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysLater = new Date(t0.getTime() + 7 * 24 * 60 * 60 * 1000);

  const totalPaise = invoiceTotalPaise(invoice);

  // Find similar invoices: same totalInvoicePaise + same customer within ±7 days
  const similarInvoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      id: { not: invoice.id },
      customerId: invoice.customerId,
      totalInvoicePaise: totalPaise, // ✅ correct field (not totalAmount)
      // Use invoiceDate if schema has it; Prisma will error if we put unknown field.
      // So we filter by createdAt universally if it exists; but we don't know your schema.
      // Most schemas have createdAt; if yours does not, remove createdAt filter below.
      createdAt: { gte: sevenDaysAgo, lte: sevenDaysLater } as any,
    } as any,
    take: 10,
  });

  if (similarInvoices.length > 0) {
    let maxSimilarity = 0;

    for (const similar of similarInvoices) {
      let similarity = 0;

      if (invoiceTotalPaise(similar) === totalPaise) similarity += 40;
      if (similar.customerId === invoice.customerId) similarity += 30;

      const t1 = invoiceTimestamp(similar);
      const daysDiff = Math.abs((t1.getTime() - t0.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff < 1) similarity += 30;
      else if (daysDiff < 3) similarity += 20;
      else similarity += 10;

      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    if (maxSimilarity >= 70) {
      return {
        isDuplicate: true,
        duplicateIds: similarInvoices.map((i: any) => i.id),
        similarityScore: maxSimilarity,
      };
    }
  }

  return { isDuplicate: false, duplicateIds: [], similarityScore: 0 };
}

async function checkForAnomalies(
  tenantId: number,
  invoice: any
): Promise<{
  isAnomaly: boolean;
  anomalyType?: "DUPLICATE" | "INFLATED" | "UNUSUAL_AMOUNT";
  anomalyScore?: number;
}> {
  const customerInvoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      customerId: invoice.customerId,
      id: { not: invoice.id },
    },
    take: 10,
  });

  if (customerInvoices.length > 0) {
    const avgPaise =
      customerInvoices.reduce((sum: number, inv: any) => sum + invoiceTotalPaise(inv), 0) /
      customerInvoices.length;

    const currentPaise = invoiceTotalPaise(invoice);

    if (avgPaise > 0 && currentPaise > avgPaise * 2) {
      return {
        isAnomaly: true,
        anomalyType: "INFLATED",
        anomalyScore: Math.min(100, ((currentPaise - avgPaise) / avgPaise) * 50),
      };
    }

    if (avgPaise > 0 && currentPaise < avgPaise * 0.1) {
      return {
        isAnomaly: true,
        anomalyType: "UNUSUAL_AMOUNT",
        anomalyScore: 60,
      };
    }
  }

  return { isAnomaly: false };
}

function generateSummary(invoice: any): string {
  const totalPaise = invoiceTotalPaise(invoice);
  const lineItems = invoice.lineItems || [];
  const itemCount = lineItems.length;
  const when = invoiceTimestamp(invoice);

  return `Invoice for ₹${(totalPaise / 100).toFixed(2)} with ${itemCount} item(s). ${
    invoice.customer?.name || "Customer"
  } - ${when.toLocaleDateString()}`;
}

function extractKeyPoints(invoice: any): string[] {
  const points: string[] = [];
  const totalPaise = invoiceTotalPaise(invoice);

  points.push(`Total: ₹${(totalPaise / 100).toFixed(2)}`);

  if (invoice.customer?.name) points.push(`Customer: ${invoice.customer.name}`);

  const lineItems = invoice.lineItems || [];
  if (lineItems.length > 0) points.push(`Items: ${lineItems.length}`);

  if (invoice.invoiceNumber) points.push(`Invoice #: ${invoice.invoiceNumber}`);

  return points;
}

function extractSearchKeywords(invoice: any): string[] {
  const keywords: string[] = [];

  if (invoice.customer?.name) keywords.push(invoice.customer.name.toLowerCase());
  if (invoice.invoiceNumber) keywords.push(String(invoice.invoiceNumber).toLowerCase());

  const lineItems = invoice.lineItems || [];
  for (const item of lineItems) {
    if (item.productName) keywords.push(item.productName.toLowerCase());
  }

  return Array.from(new Set(keywords));
}
