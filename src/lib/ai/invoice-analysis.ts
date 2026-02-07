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
  duplicateInvoiceIds?: string[];
  similarityScore?: number;
  summary?: string;
  keyPoints?: string[];
  searchKeywords?: string[];
}

/**
 * Analyze invoice
 */
export async function analyzeInvoice(
  tenantId: string,
  invoiceId: string
): Promise<InvoiceAnalysisResult> {
  try {
    const result: InvoiceAnalysisResult = {
      isAnomaly: false,
      isDuplicate: false,
    };

    // Get invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lineItems: true,
        customer: true,
      },
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    // Categorize invoice
    const category = categorizeInvoice(invoice);
    result.category = category.category;
    result.subcategory = category.subcategory;

    // Check for duplicates
    const duplicateCheck = await checkForDuplicates(tenantId, invoice);
    if (duplicateCheck.isDuplicate) {
      result.isDuplicate = true;
      result.duplicateInvoiceIds = duplicateCheck.duplicateIds;
      result.similarityScore = duplicateCheck.similarityScore;
      result.isAnomaly = true;
      result.anomalyType = "DUPLICATE";
      result.anomalyScore = duplicateCheck.similarityScore;
    }

    // Check for anomalies
    const anomalyCheck = await checkForAnomalies(tenantId, invoice);
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
  // Simple categorization based on invoice data
  const totalAmount = invoice.totalAmount || 0;
  const lineItems = invoice.lineItems || [];

  // Check if it's a subscription-related invoice
  if (invoice.customer?.email?.includes("@pharmapulse")) {
    return {
      category: "SUBSCRIPTION",
      subcategory: "RENEWAL",
    };
  }

  // Check for credit top-ups
  if (lineItems.some((item: any) => item.productName?.toLowerCase().includes("credit"))) {
    return {
      category: "CREDITS",
      subcategory: "TOP_UP",
    };
  }

  // Check for add-ons
  if (lineItems.some((item: any) => item.productName?.toLowerCase().includes("addon"))) {
    return {
      category: "ADDONS",
      subcategory: "FEATURE",
    };
  }

  // Default
  return {
    category: "OTHER",
    subcategory: "GENERAL",
  };
}

async function checkForDuplicates(
  tenantId: string,
  invoice: any
): Promise<{
  isDuplicate: boolean;
  duplicateIds: string[];
  similarityScore: number;
}> {
  // Get similar invoices (same amount, same customer, within 7 days)
  const sevenDaysAgo = new Date(invoice.createdAt.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysLater = new Date(invoice.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  const similarInvoices = await prisma.invoice.findMany({
    where: {
      tenantId: parseInt(tenantId) || 1,
      id: {
        not: invoice.id,
      },
      totalAmount: invoice.totalAmount,
      customerId: invoice.customerId,
      createdAt: {
        gte: sevenDaysAgo,
        lte: sevenDaysLater,
      },
    },
    take: 10,
  });

  if (similarInvoices.length > 0) {
    // Calculate similarity score
    let maxSimilarity = 0;
    for (const similar of similarInvoices) {
      let similarity = 0;

      // Amount match
      if (similar.totalAmount === invoice.totalAmount) {
        similarity += 40;
      }

      // Customer match
      if (similar.customerId === invoice.customerId) {
        similarity += 30;
      }

      // Date proximity
      const daysDiff = Math.abs(
        (similar.createdAt.getTime() - invoice.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff < 1) {
        similarity += 30;
      } else if (daysDiff < 3) {
        similarity += 20;
      } else {
        similarity += 10;
      }

      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    if (maxSimilarity >= 70) {
      return {
        isDuplicate: true,
        duplicateIds: similarInvoices.map((i) => i.id),
        similarityScore: maxSimilarity,
      };
    }
  }

  return {
    isDuplicate: false,
    duplicateIds: [],
    similarityScore: 0,
  };
}

async function checkForAnomalies(
  tenantId: string,
  invoice: any
): Promise<{
  isAnomaly: boolean;
  anomalyType?: "DUPLICATE" | "INFLATED" | "UNUSUAL_AMOUNT";
  anomalyScore?: number;
}> {
  // Get average invoice amount for this customer
  const customerInvoices = await prisma.invoice.findMany({
    where: {
      tenantId: parseInt(tenantId) || 1,
      customerId: invoice.customerId,
      id: {
        not: invoice.id,
      },
    },
    take: 10,
  });

  if (customerInvoices.length > 0) {
    const avgAmount = customerInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0) / customerInvoices.length;
    const currentAmount = invoice.totalAmount || 0;

    // Check if amount is unusually high
    if (currentAmount > avgAmount * 2) {
      return {
        isAnomaly: true,
        anomalyType: "INFLATED",
        anomalyScore: Math.min(100, ((currentAmount - avgAmount) / avgAmount) * 50),
      };
    }

    // Check if amount is unusually low
    if (currentAmount < avgAmount * 0.1) {
      return {
        isAnomaly: true,
        anomalyType: "UNUSUAL_AMOUNT",
        anomalyScore: 60,
      };
    }
  }

  return {
    isAnomaly: false,
  };
}

function generateSummary(invoice: any): string {
  const totalAmount = invoice.totalAmount || 0;
  const lineItems = invoice.lineItems || [];
  const itemCount = lineItems.length;

  return `Invoice for ₹${(totalAmount / 100).toFixed(2)} with ${itemCount} item(s). ${invoice.customer?.name || "Customer"} - ${new Date(invoice.createdAt).toLocaleDateString()}`;
}

function extractKeyPoints(invoice: any): string[] {
  const points: string[] = [];

  const totalAmount = invoice.totalAmount || 0;
  points.push(`Total: ₹${(totalAmount / 100).toFixed(2)}`);

  if (invoice.customer) {
    points.push(`Customer: ${invoice.customer.name}`);
  }

  const lineItems = invoice.lineItems || [];
  if (lineItems.length > 0) {
    points.push(`Items: ${lineItems.length}`);
  }

  if (invoice.invoiceNumber) {
    points.push(`Invoice #: ${invoice.invoiceNumber}`);
  }

  return points;
}

function extractSearchKeywords(invoice: any): string[] {
  const keywords: string[] = [];

  if (invoice.customer?.name) {
    keywords.push(invoice.customer.name.toLowerCase());
  }

  if (invoice.invoiceNumber) {
    keywords.push(invoice.invoiceNumber.toLowerCase());
  }

  const lineItems = invoice.lineItems || [];
  for (const item of lineItems) {
    if (item.productName) {
      keywords.push(item.productName.toLowerCase());
    }
  }

  return [...new Set(keywords)]; // Remove duplicates
}
