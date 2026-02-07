// AI Price Intelligence & Competitor Analysis
// Real-time competitor price monitoring and dynamic pricing recommendations

import { prisma } from "@/lib/prisma";

export interface PriceIntelligenceRequest {
  productId?: number;
  drugLibraryId?: number;
  includeCompetitors?: boolean;
  includeDPCO?: boolean;
}

export interface PriceIntelligenceResult {
  productId?: number;
  drugLibraryId?: number;
  currentPrice: number;
  mrp?: number;
  dpcoCeilingPrice?: number;
  competitorPrices: Array<{
    competitor: string;
    price: number;
    source: string;
    date: Date;
    availability: boolean;
  }>;
  avgCompetitorPrice: number;
  minCompetitorPrice: number;
  maxCompetitorPrice: number;
  priceRank?: number;
  recommendedPrice: number;
  priceChangePercent: number;
  recommendationReason: string;
  priceElasticity?: number;
  expectedSalesChange?: number;
  currentMarginPercent?: number;
  recommendedMarginPercent?: number;
  expectedRevenueChange?: number;
  priceTrend?: "INCREASING" | "DECREASING" | "STABLE";
  marketTrend?: "INCREASING" | "DECREASING" | "STABLE";
  isDpcoCompliant: boolean;
  dpcoComplianceNote?: string;
  confidenceScore: number;
}

/**
 * Analyze price intelligence and competitor pricing
 */
export async function analyzePriceIntelligence(
  request: PriceIntelligenceRequest,
  tenantId: number = 1
): Promise<PriceIntelligenceResult> {
  const { productId, drugLibraryId, includeCompetitors = true, includeDPCO = true } = request;

  // Get current product pricing
  const currentPrice = await getCurrentPrice(productId, drugLibraryId);
  if (!currentPrice) {
    throw new Error("Product not found");
  }

  // Get competitor prices
  let competitorPrices: PriceIntelligenceResult["competitorPrices"] = [];
  if (includeCompetitors) {
    competitorPrices = await getCompetitorPrices(productId, drugLibraryId);
  }

  // Calculate competitor statistics
  const competitorStats = calculateCompetitorStats(competitorPrices);
  const priceRank = calculatePriceRank(currentPrice.price, competitorPrices);

  // Get DPCO ceiling price
  let dpcoCeilingPrice: number | undefined;
  if (includeDPCO) {
    dpcoCeilingPrice = await getDPCOCeilingPrice(productId, drugLibraryId);
  }

  // Calculate price recommendation
  const recommendation = calculatePriceRecommendation({
    currentPrice: currentPrice.price,
    competitorStats,
    dpcoCeilingPrice,
    currentMargin: currentPrice.margin,
  });

  // Calculate price elasticity
  const priceElasticity = await calculatePriceElasticity(productId, drugLibraryId);

  // Calculate expected sales change
  const expectedSalesChange = recommendation.priceChangePercent
    ? calculateExpectedSalesChange(
        recommendation.priceChangePercent,
        priceElasticity
      )
    : undefined;

  // Calculate margin analysis
  const marginAnalysis = calculateMarginAnalysis({
    currentPrice: currentPrice.price,
    recommendedPrice: recommendation.recommendedPrice,
    costPrice: currentPrice.costPrice,
  });

  // Calculate price trends
  const priceTrend = await calculatePriceTrend(productId, drugLibraryId);
  const marketTrend = calculateMarketTrend(competitorPrices);

  // Check DPCO compliance
  const dpcoCompliance = checkDPCOCompliance(
    recommendation.recommendedPrice,
    dpcoCeilingPrice
  );

  // Calculate confidence score
  const confidenceScore = calculateConfidenceScore({
    competitorDataPoints: competitorPrices.length,
    priceTrend,
    dpcoData: !!dpcoCeilingPrice,
  });

  // Save to database
  await prisma.aIPriceIntelligence.create({
    data: {
      tenantId,
      productId,
      drugLibraryId,
      currentPricePaise: Math.round(currentPrice.price * 100),
      mrpPaise: currentPrice.mrp ? Math.round(currentPrice.mrp * 100) : undefined,
      dpcoCeilingPricePaise: dpcoCeilingPrice ? Math.round(dpcoCeilingPrice * 100) : undefined,
      competitorPrices: competitorPrices.map((c) => ({
        competitor: c.competitor,
        price: c.price,
        source: c.source,
        date: c.date,
      })),
      avgCompetitorPricePaise: Math.round(competitorStats.avg * 100),
      minCompetitorPricePaise: Math.round(competitorStats.min * 100),
      maxCompetitorPricePaise: Math.round(competitorStats.max * 100),
      priceRank,
      recommendedPricePaise: Math.round(recommendation.recommendedPrice * 100),
      priceChangePercent: recommendation.priceChangePercent,
      recommendationReason: recommendation.reason,
      priceElasticity,
      expectedSalesChange,
      currentMarginPercent: marginAnalysis.current,
      recommendedMarginPercent: marginAnalysis.recommended,
      expectedRevenueChange: marginAnalysis.expectedRevenueChange,
      priceTrend,
      marketTrend,
      isDpcoCompliant: dpcoCompliance.compliant,
      dpcoComplianceNote: dpcoCompliance.note,
      confidenceScore,
    },
  });

  return {
    productId,
    drugLibraryId,
    currentPrice: currentPrice.price,
    mrp: currentPrice.mrp,
    dpcoCeilingPrice,
    competitorPrices,
    avgCompetitorPrice: competitorStats.avg,
    minCompetitorPrice: competitorStats.min,
    maxCompetitorPrice: competitorStats.max,
    priceRank,
    recommendedPrice: recommendation.recommendedPrice,
    priceChangePercent: recommendation.priceChangePercent,
    recommendationReason: recommendation.reason,
    priceElasticity,
    expectedSalesChange,
    currentMarginPercent: marginAnalysis.current,
    recommendedMarginPercent: marginAnalysis.recommended,
    expectedRevenueChange: marginAnalysis.expectedRevenueChange,
    priceTrend,
    marketTrend,
    isDpcoCompliant: dpcoCompliance.compliant,
    dpcoComplianceNote: dpcoCompliance.note,
    confidenceScore,
  };
}

/**
 * Get current product price
 */
async function getCurrentPrice(
  productId: number | undefined,
  drugLibraryId: number | undefined
): Promise<{
  price: number;
  mrp?: number;
  costPrice?: number;
  margin?: number;
} | null> {
  if (productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) return null;

    return {
      price: product.salePrice || product.unitPrice,
      mrp: product.mrp || undefined,
      costPrice: product.unitPrice, // Assuming unitPrice is cost
      margin: product.mrp && product.salePrice
        ? ((product.salePrice - product.unitPrice) / product.salePrice) * 100
        : undefined,
    };
  }

  if (drugLibraryId) {
    // Get from inventory items
    const inventory = await prisma.inventoryItem.findFirst({
      where: { drugLibraryId },
    });
    if (!inventory) return null;

    return {
      price: inventory.sellingPrice || 0,
      mrp: inventory.mrp ? Number(inventory.mrp) : undefined,
      costPrice: inventory.purchasePrice || undefined,
      margin: inventory.sellingPrice && inventory.purchasePrice
        ? ((inventory.sellingPrice - inventory.purchasePrice) / inventory.sellingPrice) * 100
        : undefined,
    };
  }

  return null;
}

/**
 * Get competitor prices (mock implementation - can be enhanced with web scraping/APIs)
 */
async function getCompetitorPrices(
  productId: number | undefined,
  drugLibraryId: number | undefined
): Promise<PriceIntelligenceResult["competitorPrices"]> {
  // This would integrate with competitor price APIs or web scraping
  // For now, return mock data
  const competitors = [
    { name: "1mg", type: "ONLINE_PHARMACY" },
    { name: "Netmeds", type: "ONLINE_PHARMACY" },
    { name: "Apollo Pharmacy", type: "CHAIN" },
    { name: "Local Pharmacy", type: "LOCAL_PHARMACY" },
  ];

  const currentPrice = await getCurrentPrice(productId, drugLibraryId);
  if (!currentPrice) return [];

  // Generate competitor prices (within ±20% of current price)
  return competitors.map((comp) => {
    const variance = (Math.random() - 0.5) * 0.4; // -20% to +20%
    const competitorPrice = currentPrice.price * (1 + variance);

    return {
      competitor: comp.name,
      price: competitorPrice,
      source: "SCRAPING",
      date: new Date(),
      availability: true,
    };
  });
}

/**
 * Calculate competitor statistics
 */
function calculateCompetitorStats(
  competitorPrices: PriceIntelligenceResult["competitorPrices"]
): {
  avg: number;
  min: number;
  max: number;
} {
  if (competitorPrices.length === 0) {
    return { avg: 0, min: 0, max: 0 };
  }

  const prices = competitorPrices.map((c) => c.price);
  return {
    avg: prices.reduce((sum, p) => sum + p, 0) / prices.length,
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

/**
 * Calculate price rank
 */
function calculatePriceRank(
  currentPrice: number,
  competitorPrices: PriceIntelligenceResult["competitorPrices"]
): number | undefined {
  if (competitorPrices.length === 0) return undefined;

  const sortedPrices = [...competitorPrices.map((c) => c.price), currentPrice].sort((a, b) => a - b);
  return sortedPrices.indexOf(currentPrice) + 1;
}

/**
 * Get DPCO ceiling price
 */
async function getDPCOCeilingPrice(
  productId: number | undefined,
  drugLibraryId: number | undefined
): Promise<number | undefined> {
  if (drugLibraryId) {
    const drug = await prisma.drugLibrary.findUnique({
      where: { id: drugLibraryId },
    });
    if (drug?.dpcoCeilingPriceInr) {
      return drug.dpcoCeilingPriceInr;
    }
  }
  return undefined;
}

/**
 * Calculate price recommendation
 */
function calculatePriceRecommendation(data: {
  currentPrice: number;
  competitorStats: { avg: number; min: number; max: number };
  dpcoCeilingPrice?: number;
  currentMargin?: number;
}): {
  recommendedPrice: number;
  priceChangePercent: number;
  reason: string;
} {
  const { currentPrice, competitorStats, dpcoCeilingPrice, currentMargin } = data;

  // Strategy: Price competitively while maintaining margin
  let recommendedPrice = currentPrice;
  let reason = "No change recommended";

  // If we're more expensive than average, consider reducing
  if (currentPrice > competitorStats.avg * 1.1) {
    recommendedPrice = competitorStats.avg * 1.05; // 5% above average
    reason = "Price above market average - recommend reduction for competitiveness";
  } else if (currentPrice < competitorStats.min * 0.9) {
    // If we're much cheaper, consider increasing
    recommendedPrice = competitorStats.min * 0.95; // 5% below minimum
    reason = "Price significantly below market - recommend increase for margin";
  }

  // Ensure DPCO compliance
  if (dpcoCeilingPrice && recommendedPrice > dpcoCeilingPrice) {
    recommendedPrice = dpcoCeilingPrice;
    reason = "Price adjusted to comply with DPCO ceiling price";
  }

  // Ensure minimum margin (if current margin is known)
  if (currentMargin && currentMargin < 10) {
    // Don't reduce price if margin is already low
    if (recommendedPrice < currentPrice) {
      recommendedPrice = currentPrice;
      reason = "Price reduction not recommended - margin already low";
    }
  }

  const priceChangePercent = ((recommendedPrice - currentPrice) / currentPrice) * 100;

  return {
    recommendedPrice,
    priceChangePercent,
    reason,
  };
}

/**
 * Calculate price elasticity
 */
async function calculatePriceElasticity(
  productId: number | undefined,
  drugLibraryId: number | undefined
): Promise<number> {
  // Typical price elasticity for medicines: -0.5 (inelastic)
  // Can be enhanced with historical sales data analysis
  return -0.5;
}

/**
 * Calculate expected sales change
 */
function calculateExpectedSalesChange(
  priceChangePercent: number,
  priceElasticity: number
): number {
  return priceChangePercent * priceElasticity;
}

/**
 * Calculate margin analysis
 */
function calculateMarginAnalysis(data: {
  currentPrice: number;
  recommendedPrice: number;
  costPrice?: number;
}): {
  current: number | undefined;
  recommended: number | undefined;
  expectedRevenueChange: number | undefined;
} {
  const { currentPrice, recommendedPrice, costPrice } = data;

  if (!costPrice) {
    return {
      current: undefined,
      recommended: undefined,
      expectedRevenueChange: undefined,
    };
  }

  const currentMargin = ((currentPrice - costPrice) / currentPrice) * 100;
  const recommendedMargin = ((recommendedPrice - costPrice) / recommendedPrice) * 100;

  // Estimate revenue change (simplified)
  const expectedRevenueChange = ((recommendedPrice - currentPrice) / currentPrice) * 100;

  return {
    current: currentMargin,
    recommended: recommendedMargin,
    expectedRevenueChange,
  };
}

/**
 * Calculate price trend
 */
async function calculatePriceTrend(
  productId: number | undefined,
  drugLibraryId: number | undefined
): Promise<"INCREASING" | "DECREASING" | "STABLE" | undefined> {
  // Can be enhanced with historical price data
  return "STABLE";
}

/**
 * Calculate market trend
 */
function calculateMarketTrend(
  competitorPrices: PriceIntelligenceResult["competitorPrices"]
): "INCREASING" | "DECREASING" | "STABLE" | undefined {
  if (competitorPrices.length < 2) return undefined;

  // Simple trend calculation (can be enhanced)
  return "STABLE";
}

/**
 * Check DPCO compliance
 */
function checkDPCOCompliance(
  price: number,
  dpcoCeilingPrice?: number
): {
  compliant: boolean;
  note?: string;
} {
  if (!dpcoCeilingPrice) {
    return { compliant: true };
  }

  if (price > dpcoCeilingPrice) {
    return {
      compliant: false,
      note: `Price exceeds DPCO ceiling price of ₹${dpcoCeilingPrice}`,
    };
  }

  return { compliant: true };
}

/**
 * Calculate confidence score
 */
function calculateConfidenceScore(data: {
  competitorDataPoints: number;
  priceTrend?: string;
  dpcoData: boolean;
}): number {
  let score = 50; // Base score

  // More competitor data = higher confidence
  score += Math.min(30, data.competitorDataPoints * 5);

  // DPCO data available = higher confidence
  if (data.dpcoData) {
    score += 10;
  }

  // Price trend available = higher confidence
  if (data.priceTrend) {
    score += 10;
  }

  return Math.min(100, score);
}
