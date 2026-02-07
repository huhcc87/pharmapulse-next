// AI Inventory Optimization
// Smart reorder suggestions, deadstock prediction, expiry risk scoring
// Optimized for Indian pharmacy market

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface InventoryAnalysisResult {
  productId?: number;
  drugLibraryId?: number;
  analysisType: "REORDER" | "DEADSTOCK" | "EXPIRY" | "BUNDLE" | "PRICING";
  
  // Reorder Analysis
  suggestedReorderQty?: number;
  reorderPoint?: number;
  safetyStock?: number;
  leadTimeDays?: number;
  
  // Deadstock Prediction
  deadstockRiskScore?: number; // 0-100
  daysToDeadstock?: number;
  predictedSaleDate?: Date;
  
  // Expiry Risk
  expiryRiskScore?: number; // 0-100
  daysToExpiry?: number;
  recommendedDiscount?: number; // Percentage
  
  // Bundle Recommendations
  suggestedBundleIds?: number[];
  bundleScore?: number;
  
  // Pricing
  recommendedPricePaise?: number;
  priceChangePercent?: number;
  pricingReason?: string;
  
  confidenceScore?: number; // 0-100
  reasoning?: string;
}

/**
 * Analyze inventory for optimization
 * Uses time-series analysis, sales patterns, expiry trends
 */
export async function analyzeInventoryOptimization(
  productId?: number,
  drugLibraryId?: number,
  tenantId: number = 1
): Promise<InventoryAnalysisResult[]> {
  try {
    const results: InventoryAnalysisResult[] = [];

    // Get product sales history (last 90 days)
    const salesHistory = await getSalesHistory(productId, drugLibraryId, tenantId);
    
    // Get current inventory
    const inventory = await getCurrentInventory(productId, drugLibraryId, tenantId);
    
    // Get batches with expiry info
    const batches = await getBatchesWithExpiry(productId, drugLibraryId, tenantId);

    // 1. Reorder Analysis
    const reorderAnalysis = analyzeReorderPoint(
      salesHistory,
      inventory,
      batches
    );
    results.push(reorderAnalysis);

    // 2. Deadstock Prediction
    const deadstockAnalysis = predictDeadstock(
      salesHistory,
      inventory,
      batches
    );
    results.push(deadstockAnalysis);

    // 3. Expiry Risk Analysis
    const expiryAnalysis = analyzeExpiryRisk(batches);
    results.push(expiryAnalysis);

    // 4. Bundle Recommendations
    const bundleAnalysis = suggestBundles(productId, drugLibraryId, tenantId);
    results.push(bundleAnalysis);

    // 5. Pricing Suggestions
    const pricingAnalysis = suggestPricing(
      productId,
      drugLibraryId,
      salesHistory,
      inventory,
      tenantId
    );
    results.push(pricingAnalysis);

    return results;
  } catch (error: any) {
    console.error("Inventory optimization analysis error:", error);
    throw error;
  }
}

/**
 * Calculate reorder point using:
 * ROP = (Avg Daily Demand × Lead Time) + Safety Stock
 * Safety Stock = (Max Daily Demand - Avg Daily Demand) × Lead Time
 */
function analyzeReorderPoint(
  salesHistory: any[],
  inventory: any,
  batches: any[]
): InventoryAnalysisResult {
  // Calculate average daily demand (last 30 days)
  const last30Days = salesHistory.filter(
    (s) => new Date(s.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  const totalQty = last30Days.reduce((sum, s) => sum + (s.quantity || 0), 0);
  const avgDailyDemand = totalQty / 30;

  // Calculate max daily demand
  const dailyDemands = last30Days.reduce((acc: Record<string, number>, s) => {
    const date = new Date(s.date).toDateString();
    acc[date] = (acc[date] || 0) + (s.quantity || 0);
    return acc;
  }, {});
  const maxDailyDemand = Math.max(...Object.values(dailyDemands));

  // Lead time (default 7 days for Indian market)
  const leadTimeDays = 7;

  // Safety stock calculation
  const safetyStock = Math.ceil((maxDailyDemand - avgDailyDemand) * leadTimeDays);

  // Reorder point
  const reorderPoint = Math.ceil(avgDailyDemand * leadTimeDays + safetyStock);

  // Suggested reorder quantity (if current stock < reorder point)
  const currentStock = inventory?.stockLevel || 0;
  const suggestedReorderQty =
    currentStock < reorderPoint ? Math.ceil(reorderPoint * 1.5) - currentStock : 0;

  return {
    analysisType: "REORDER",
    suggestedReorderQty,
    reorderPoint: Math.max(0, reorderPoint),
    safetyStock: Math.max(0, safetyStock),
    leadTimeDays,
    confidenceScore: salesHistory.length >= 30 ? 85 : 60,
    reasoning: `Based on ${last30Days.length} days of sales data. Average daily demand: ${avgDailyDemand.toFixed(1)}, Max daily demand: ${maxDailyDemand}, Safety stock: ${safetyStock}`,
  };
}

/**
 * Predict deadstock risk (90 days ahead)
 * Uses sales velocity, trend analysis, seasonality
 */
function predictDeadstock(
  salesHistory: any[],
  inventory: any,
  batches: any[]
): InventoryAnalysisResult {
  const currentStock = inventory?.stockLevel || 0;
  
  if (currentStock === 0) {
    return {
      analysisType: "DEADSTOCK",
      deadstockRiskScore: 0,
      confidenceScore: 100,
      reasoning: "No stock available",
    };
  }

  // Calculate sales velocity (units per day)
  const last60Days = salesHistory.filter(
    (s) => new Date(s.date) >= new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
  );
  const totalSold = last60Days.reduce((sum, s) => sum + (s.quantity || 0), 0);
  const salesVelocity = totalSold / 60; // Units per day

  // Predict days to sell out
  const daysToSellOut = salesVelocity > 0 ? Math.ceil(currentStock / salesVelocity) : 999;

  // Deadstock risk scoring (0-100)
  let deadstockRiskScore = 0;
  if (daysToSellOut > 180) {
    deadstockRiskScore = 90; // Very high risk
  } else if (daysToSellOut > 120) {
    deadstockRiskScore = 70; // High risk
  } else if (daysToSellOut > 90) {
    deadstockRiskScore = 50; // Medium risk
  } else if (daysToSellOut > 60) {
    deadstockRiskScore = 30; // Low risk
  }

  // Trend analysis (increasing/decreasing sales)
  const recent30Days = last60Days.slice(-30);
  const older30Days = last60Days.slice(0, 30);
  const recentSold = recent30Days.reduce((sum, s) => sum + (s.quantity || 0), 0);
  const olderSold = older30Days.reduce((sum, s) => sum + (s.quantity || 0), 0);
  
  if (recentSold < olderSold * 0.7) {
    // Sales declining > 30%
    deadstockRiskScore = Math.min(100, deadstockRiskScore + 20);
  }

  const predictedSaleDate = salesVelocity > 0
    ? new Date(Date.now() + daysToSellOut * 24 * 60 * 60 * 1000)
    : undefined;

  return {
    analysisType: "DEADSTOCK",
    deadstockRiskScore,
    daysToDeadstock: daysToSellOut > 999 ? undefined : daysToSellOut,
    predictedSaleDate,
    confidenceScore: salesHistory.length >= 60 ? 80 : 60,
    reasoning: `Sales velocity: ${salesVelocity.toFixed(2)} units/day. Projected days to sell out: ${daysToSellOut}. Risk score based on sales trend and inventory level.`,
  };
}

/**
 * Analyze expiry risk
 * Suggests discounts for products nearing expiry
 */
function analyzeExpiryRisk(batches: any[]): InventoryAnalysisResult {
  const now = new Date();
  let totalExpiryRisk = 0;
  let nearestExpiryDays = Infinity;

  for (const batch of batches) {
    if (batch.expiryDate) {
      const expiryDate = new Date(batch.expiryDate);
      const daysToExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      nearestExpiryDays = Math.min(nearestExpiryDays, daysToExpiry);

      // Calculate risk per batch
      let batchRisk = 0;
      if (daysToExpiry <= 30) {
        batchRisk = 90 + (30 - daysToExpiry) * 0.33; // 90-100 for <30 days
      } else if (daysToExpiry <= 60) {
        batchRisk = 70 + (60 - daysToExpiry) * 0.67; // 70-90 for 30-60 days
      } else if (daysToExpiry <= 90) {
        batchRisk = 50 + (90 - daysToExpiry) * 0.67; // 50-70 for 60-90 days
      }

      // Weight by quantity
      const qtyWeight = Math.min(1, (batch.quantityOnHand || 0) / 100);
      totalExpiryRisk = Math.max(totalExpiryRisk, batchRisk * qtyWeight);
    }
  }

  const expiryRiskScore = Math.min(100, totalExpiryRisk);
  
  // Recommend discount based on days to expiry
  let recommendedDiscount = 0;
  if (nearestExpiryDays <= 30) {
    recommendedDiscount = 30 - (nearestExpiryDays / 30) * 10; // 20-30%
  } else if (nearestExpiryDays <= 60) {
    recommendedDiscount = 15 - ((nearestExpiryDays - 30) / 30) * 5; // 10-15%
  } else if (nearestExpiryDays <= 90) {
    recommendedDiscount = 10 - ((nearestExpiryDays - 60) / 30) * 5; // 5-10%
  }

  return {
    analysisType: "EXPIRY",
    expiryRiskScore,
    daysToExpiry: nearestExpiryDays === Infinity ? undefined : nearestExpiryDays,
    recommendedDiscount: recommendedDiscount > 0 ? Math.round(recommendedDiscount) : undefined,
    confidenceScore: batches.length > 0 ? 90 : 0,
    reasoning: `Nearest expiry in ${nearestExpiryDays} days. Recommended discount: ${recommendedDiscount.toFixed(1)}% to move inventory.`,
  };
}

/**
 * Suggest product bundles based on purchase patterns
 */
async function suggestBundles(
  productId?: number,
  drugLibraryId?: number,
  tenantId: number = 1
): Promise<InventoryAnalysisResult> {
  // TODO: Implement bundle recommendation using collaborative filtering
  // For now, return empty result
  return {
    analysisType: "BUNDLE",
    suggestedBundleIds: [],
    bundleScore: 0,
    confidenceScore: 0,
    reasoning: "Bundle recommendations require purchase pattern analysis (coming soon).",
  };
}

/**
 * Suggest pricing optimization
 * Based on demand elasticity, competitor prices, margin analysis
 */
async function suggestPricing(
  productId?: number,
  drugLibraryId?: number,
  salesHistory: any[],
  inventory: any,
  tenantId: number = 1
): Promise<InventoryAnalysisResult> {
  // TODO: Implement pricing optimization
  // For now, return empty result
  return {
    analysisType: "PRICING",
    confidenceScore: 0,
    reasoning: "Pricing optimization requires competitive data and demand elasticity analysis (coming soon).",
  };
}

// Helper functions

async function getSalesHistory(
  productId?: number,
  drugLibraryId?: number,
  tenantId: number = 1
): Promise<any[]> {
  // Get sales from InvoiceLineItems
  const where: any = { tenantId };
  if (productId) {
    where.productId = productId;
  }
  if (drugLibraryId) {
    where.drugLibraryId = drugLibraryId;
  }

  const lineItems = await prisma.invoiceLineItem.findMany({
    where: {
      invoice: {
        tenantId,
        status: "ISSUED",
      },
      ...(productId && { productId }),
      ...(drugLibraryId && { drugLibraryId }),
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
        invoiceDate: "desc",
      },
    },
    take: 200, // Last 200 transactions
  });

  return lineItems.map((item) => ({
    date: item.invoice.invoiceDate,
    quantity: item.quantity,
    pricePaise: item.unitPricePaise,
  }));
}

async function getCurrentInventory(
  productId?: number,
  drugLibraryId?: number,
  tenantId: number = 1
): Promise<any> {
  if (productId) {
    return await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        stockLevel: true,
        minStock: true,
        unitPrice: true,
        mrp: true,
      },
    });
  }
  return null;
}

async function getBatchesWithExpiry(
  productId?: number,
  drugLibraryId?: number,
  tenantId: number = 1
): Promise<any[]> {
  const where: any = {};
  if (productId) {
    where.productId = productId;
  }
  if (drugLibraryId) {
    where.drugLibraryId = drugLibraryId;
  }

  return await prisma.batch.findMany({
    where,
    select: {
      id: true,
      batchCode: true,
      expiryDate: true,
      quantityOnHand: true,
    },
    orderBy: {
      expiryDate: "asc",
    },
  });
}
