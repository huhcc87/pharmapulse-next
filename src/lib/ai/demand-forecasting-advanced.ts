// AI Demand Forecasting (Advanced)
// Seasonal, event-based, and weather-based demand forecasting for Indian market

import { prisma } from "@/lib/prisma";

export interface AdvancedDemandForecastRequest {
  productId?: number;
  drugLibraryId?: number;
  forecastType?: "DAILY" | "WEEKLY" | "MONTHLY" | "SEASONAL";
  horizonDays?: number;
  region?: string;
  includeSeasonality?: boolean;
  includeEvents?: boolean;
  includeWeather?: boolean;
}

export interface AdvancedDemandForecast {
  productId?: number;
  drugLibraryId?: number;
  forecastType: "DAILY" | "WEEKLY" | "MONTHLY" | "SEASONAL";
  horizonDays: number;
  forecastedQty: number;
  confidenceLevel: number;
  forecastSeries: Array<{
    date: string;
    forecastedQty: number;
    upperBound?: number;
    lowerBound?: number;
  }>;
  season?: "MONSOON" | "SUMMER" | "WINTER" | "FESTIVAL";
  seasonalityFactor?: number;
  festivalFactor?: number;
  eventImpact?: {
    type: string;
    impact: number;
    description: string;
  };
  weatherImpact?: {
    type: string;
    factor: number;
    impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  };
  regionalFactor?: number;
  regionalTrend?: "INCREASING" | "DECREASING" | "STABLE";
  recommendedOrderQty?: number;
  recommendedOrderDate?: Date;
  supplierLeadTimeDays?: number;
  dpcoPriceImpact?: number;
  priceElasticity?: number;
  modelType: string;
  modelAccuracy?: number;
  insights: string[];
  riskFactors: string[];
  upperBound?: number;
  lowerBound?: number;
}

/**
 * Generate advanced demand forecast with seasonality, events, and weather
 */
export async function generateAdvancedDemandForecast(
  request: AdvancedDemandForecastRequest,
  tenantId: number = 1
): Promise<AdvancedDemandForecast> {
  const {
    productId,
    drugLibraryId,
    forecastType = "MONTHLY",
    horizonDays = 30,
    region,
    includeSeasonality = true,
    includeEvents = true,
    includeWeather = true,
  } = request;

  // Get historical sales data
  const historicalData = await getHistoricalSalesData(
    productId,
    drugLibraryId,
    tenantId,
    horizonDays * 3 // Get 3x horizon for training
  );

  if (historicalData.length === 0) {
    throw new Error("Insufficient historical data for forecasting");
  }

  // Base forecast using time-series analysis
  const baseForecast = calculateBaseForecast(historicalData, horizonDays);

  // Apply seasonality factors
  let seasonalityFactor = 1.0;
  let season: "MONSOON" | "SUMMER" | "WINTER" | "FESTIVAL" | undefined;
  if (includeSeasonality) {
    const seasonality = calculateSeasonality(historicalData, horizonDays);
    seasonalityFactor = seasonality.factor;
    season = seasonality.season;
  }

  // Apply festival factors
  let festivalFactor = 1.0;
  if (includeSeasonality) {
    const festival = detectFestivalPeriod(horizonDays);
    if (festival) {
      festivalFactor = getFestivalDemandFactor(productId, drugLibraryId);
    }
  }

  // Apply event-based factors
  let eventImpact: AdvancedDemandForecast["eventImpact"];
  if (includeEvents) {
    eventImpact = await detectEventImpact(productId, drugLibraryId, horizonDays);
  }

  // Apply weather-based factors
  let weatherImpact: AdvancedDemandForecast["weatherImpact"];
  if (includeWeather) {
    weatherImpact = await calculateWeatherImpact(
      productId,
      drugLibraryId,
      region,
      horizonDays
    );
  }

  // Apply regional factors
  const regional = region
    ? await calculateRegionalFactor(productId, drugLibraryId, region)
    : undefined;

  // Calculate final forecast
  let finalForecast = baseForecast.forecastedQty;
  finalForecast *= seasonalityFactor;
  finalForecast *= festivalFactor;
  if (eventImpact) {
    finalForecast *= 1 + eventImpact.impact / 100;
  }
  if (weatherImpact) {
    finalForecast *= weatherImpact.factor;
  }
  if (regional?.factor) {
    finalForecast *= regional.factor;
  }

  // Calculate confidence level
  const confidenceLevel = calculateConfidenceLevel(
    historicalData.length,
    baseForecast.confidence,
    seasonalityFactor,
    eventImpact?.impact,
    weatherImpact?.factor
  );

  // Generate forecast series
  const forecastSeries = generateForecastSeries(
    baseForecast,
    horizonDays,
    seasonalityFactor,
    festivalFactor,
    eventImpact,
    weatherImpact,
    regional
  );

  // Calculate DPCO price impact
  const dpcoImpact = await calculateDPCOPriceImpact(productId, drugLibraryId);

  // Calculate supplier lead time and recommended order
  const supplierInfo = await calculateSupplierLeadTime(productId, drugLibraryId);
  const recommendedOrder = calculateRecommendedOrder(
    finalForecast,
    supplierInfo.leadTimeDays,
    horizonDays
  );

  // Generate insights
  const insights = generateInsights({
    baseForecast,
    seasonalityFactor,
    festivalFactor,
    eventImpact,
    weatherImpact,
    regional,
    dpcoImpact,
  });

  // Identify risk factors
  const riskFactors = identifyRiskFactors({
    confidenceLevel,
    historicalData,
    seasonalityFactor,
    eventImpact,
    weatherImpact,
  });

  // Save forecast to database
  const forecastRecord = await prisma.aIDemandForecastAdvanced.create({
    data: {
      tenantId,
      productId,
      drugLibraryId,
      forecastType,
      horizonDays,
      forecastedQty: finalForecast,
      confidenceLevel,
      forecastSeries,
      season,
      seasonalityFactor,
      festivalFactor,
      eventType: eventImpact?.type,
      eventImpact: eventImpact?.impact,
      eventDescription: eventImpact?.description,
      weatherType: weatherImpact?.type,
      weatherFactor: weatherImpact?.factor,
      weatherImpact: weatherImpact?.impact,
      region,
      regionalFactor: regional?.factor,
      regionalTrend: regional?.trend,
      recommendedOrderQty: recommendedOrder.qty,
      recommendedOrderDate: recommendedOrder.date,
      supplierLeadTimeDays: supplierInfo.leadTimeDays,
      dpcoPriceImpact: dpcoImpact.impact,
      priceElasticity: dpcoImpact.elasticity,
      modelType: "ENSEMBLE",
      modelAccuracy: confidenceLevel,
      trainingDataPoints: historicalData.length,
      forecastBreakdown: forecastSeries,
      upperBound: forecastSeries[0]?.upperBound,
      lowerBound: forecastSeries[0]?.lowerBound,
      insights,
      riskFactors,
    },
  });

  return {
    productId,
    drugLibraryId,
    forecastType,
    horizonDays,
    forecastedQty: finalForecast,
    confidenceLevel,
    forecastSeries,
    season,
    seasonalityFactor,
    festivalFactor,
    eventImpact,
    weatherImpact,
    regionalFactor: regional?.factor,
    regionalTrend: regional?.trend,
    recommendedOrderQty: recommendedOrder.qty,
    recommendedOrderDate: recommendedOrder.date,
    supplierLeadTimeDays: supplierInfo.leadTimeDays,
    dpcoPriceImpact: dpcoImpact.impact,
    priceElasticity: dpcoImpact.elasticity,
    modelType: "ENSEMBLE",
    modelAccuracy: confidenceLevel,
    insights,
    riskFactors,
    upperBound: forecastSeries[0]?.upperBound,
    lowerBound: forecastSeries[0]?.lowerBound,
  };
}

/**
 * Get historical sales data
 */
async function getHistoricalSalesData(
  productId: number | undefined,
  drugLibraryId: number | undefined,
  tenantId: number,
  days: number
): Promise<Array<{ date: Date; quantity: number }>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get invoice line items
  const lineItems = await prisma.invoiceLineItem.findMany({
    where: {
      invoice: {
        tenantId,
        createdAt: { gte: startDate },
      },
      ...(productId ? { productId } : {}),
      ...(drugLibraryId ? { drugLibraryId } : {}),
    },
    include: {
      invoice: {
        select: {
          createdAt: true,
        },
      },
    },
  });

  // Group by date
  const dailySales: Record<string, number> = {};
  for (const item of lineItems) {
    const dateKey = item.invoice.createdAt.toISOString().split("T")[0];
    dailySales[dateKey] = (dailySales[dateKey] || 0) + item.quantity;
  }

  return Object.entries(dailySales).map(([date, quantity]) => ({
    date: new Date(date),
    quantity,
  }));
}

/**
 * Calculate base forecast using moving average
 */
function calculateBaseForecast(
  historicalData: Array<{ date: Date; quantity: number }>,
  horizonDays: number
): {
  forecastedQty: number;
  confidence: number;
} {
  if (historicalData.length === 0) {
    return { forecastedQty: 0, confidence: 0 };
  }

  // Simple moving average
  const totalQty = historicalData.reduce((sum, d) => sum + d.quantity, 0);
  const avgDailyQty = totalQty / historicalData.length;
  const forecastedQty = avgDailyQty * horizonDays;

  // Calculate confidence based on data points
  const confidence = Math.min(100, (historicalData.length / 30) * 100);

  return { forecastedQty, confidence };
}

/**
 * Calculate seasonality factors (Indian market)
 */
function calculateSeasonality(
  historicalData: Array<{ date: Date; quantity: number }>,
  horizonDays: number
): {
  factor: number;
  season: "MONSOON" | "SUMMER" | "WINTER" | "FESTIVAL";
} {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12

  // Determine current season
  let season: "MONSOON" | "SUMMER" | "WINTER" | "FESTIVAL";
  if (month >= 6 && month <= 9) {
    season = "MONSOON";
  } else if (month >= 10 && month <= 2) {
    season = "WINTER";
  } else {
    season = "SUMMER";
  }

  // Check for festivals
  const festivals = detectFestivalPeriod(horizonDays);
  if (festivals) {
    season = "FESTIVAL";
  }

  // Seasonality multipliers (based on Indian pharmacy patterns)
  const seasonalityMultipliers: Record<string, number> = {
    MONSOON: 1.2, // Increased demand for anti-infectives, anti-allergics
    WINTER: 1.15, // Increased demand for respiratory, immunity boosters
    SUMMER: 0.9, // Slightly lower demand
    FESTIVAL: 1.3, // Increased demand during festivals (diabetes, hypertension meds)
  };

  return {
    factor: seasonalityMultipliers[season] || 1.0,
    season,
  };
}

/**
 * Detect festival periods
 */
function detectFestivalPeriod(horizonDays: number): boolean {
  const now = new Date();
  const festivals = [
    { name: "Diwali", month: 10, day: 15 },
    { name: "Holi", month: 3, day: 8 },
    { name: "Eid", month: 4, day: 10 },
  ];

  // Check if any festival falls within horizon
  for (const festival of festivals) {
    const festivalDate = new Date(now.getFullYear(), festival.month - 1, festival.day);
    const daysDiff = Math.abs((festivalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= horizonDays) {
      return true;
    }
  }

  return false;
}

/**
 * Get festival demand factor based on drug category
 */
function getFestivalDemandFactor(
  productId: number | undefined,
  drugLibraryId: number | undefined
): number {
  // During festivals, chronic disease medications see increased demand
  // This is a simplified version - can be enhanced with drug category lookup
  return 1.2; // 20% increase
}

/**
 * Detect event-based impact (disease outbreaks, health campaigns)
 */
async function detectEventImpact(
  productId: number | undefined,
  drugLibraryId: number | undefined,
  horizonDays: number
): Promise<AdvancedDemandForecast["eventImpact"] | undefined> {
  // This would integrate with health department APIs or news feeds
  // For now, return undefined (can be enhanced)
  return undefined;
}

/**
 * Calculate weather impact on demand
 */
async function calculateWeatherImpact(
  productId: number | undefined,
  drugLibraryId: number | undefined,
  region: string | undefined,
  horizonDays: number
): Promise<AdvancedDemandForecast["weatherImpact"] | undefined> {
  // Weather-based demand patterns
  // Monsoon: anti-infectives, anti-allergics increase
  // Winter: respiratory medications increase
  // This would integrate with weather APIs
  // For now, return undefined (can be enhanced)
  return undefined;
}

/**
 * Calculate regional demand factor
 */
async function calculateRegionalFactor(
  productId: number | undefined,
  drugLibraryId: number | undefined,
  region: string
): Promise<{
  factor: number;
  trend: "INCREASING" | "DECREASING" | "STABLE";
} | undefined> {
  // Regional demand patterns
  // Can be enhanced with regional sales data analysis
  return {
    factor: 1.0,
    trend: "STABLE",
  };
}

/**
 * Calculate confidence level
 */
function calculateConfidenceLevel(
  dataPoints: number,
  baseConfidence: number,
  seasonalityFactor: number,
  eventImpact?: number,
  weatherFactor?: number
): number {
  let confidence = baseConfidence;

  // Adjust based on factors
  if (seasonalityFactor !== 1.0) {
    confidence -= 5; // Seasonality adds uncertainty
  }
  if (eventImpact) {
    confidence -= 10; // Events add uncertainty
  }
  if (weatherFactor && weatherFactor !== 1.0) {
    confidence -= 5; // Weather adds uncertainty
  }

  return Math.max(0, Math.min(100, confidence));
}

/**
 * Generate forecast series
 */
function generateForecastSeries(
  baseForecast: { forecastedQty: number; confidence: number },
  horizonDays: number,
  seasonalityFactor: number,
  festivalFactor: number,
  eventImpact?: AdvancedDemandForecast["eventImpact"],
  weatherImpact?: AdvancedDemandForecast["weatherImpact"],
  regional?: { factor?: number; trend?: string }
): Array<{
  date: string;
  forecastedQty: number;
  upperBound?: number;
  lowerBound?: number;
}> {
  const series: Array<{
    date: string;
    forecastedQty: number;
    upperBound?: number;
    lowerBound?: number;
  }> = [];

  const dailyQty = baseForecast.forecastedQty / horizonDays;

  for (let i = 0; i < horizonDays; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];

    let qty = dailyQty * seasonalityFactor * festivalFactor;
    if (eventImpact) {
      qty *= 1 + eventImpact.impact / 100;
    }
    if (weatherImpact?.factor) {
      qty *= weatherImpact.factor;
    }
    if (regional?.factor) {
      qty *= regional.factor;
    }

    const confidenceInterval = qty * 0.2; // 20% confidence interval

    series.push({
      date: dateStr,
      forecastedQty: Math.round(qty),
      upperBound: Math.round(qty + confidenceInterval),
      lowerBound: Math.round(Math.max(0, qty - confidenceInterval)),
    });
  }

  return series;
}

/**
 * Calculate DPCO price impact
 */
async function calculateDPCOPriceImpact(
  productId: number | undefined,
  drugLibraryId: number | undefined
): Promise<{
  impact: number;
  elasticity: number;
}> {
  // DPCO price changes affect demand
  // Can be enhanced with actual DPCO data
  return {
    impact: 0,
    elasticity: -0.5, // Typical price elasticity for medicines
  };
}

/**
 * Calculate supplier lead time
 */
async function calculateSupplierLeadTime(
  productId: number | undefined,
  drugLibraryId: number | undefined
): Promise<{
  leadTimeDays: number;
}> {
  // Default lead time for Indian market: 7 days
  return {
    leadTimeDays: 7,
  };
}

/**
 * Calculate recommended order
 */
function calculateRecommendedOrder(
  forecastedQty: number,
  leadTimeDays: number,
  horizonDays: number
): {
  qty: number;
  date: Date;
} {
  const orderDate = new Date();
  orderDate.setDate(orderDate.getDate() + (horizonDays - leadTimeDays));

  return {
    qty: Math.ceil(forecastedQty * 1.1), // 10% buffer
    date: orderDate,
  };
}

/**
 * Generate insights
 */
function generateInsights(data: any): string[] {
  const insights: string[] = [];

  if (data.seasonalityFactor && data.seasonalityFactor > 1.1) {
    insights.push(`Seasonal demand increase expected (${Math.round((data.seasonalityFactor - 1) * 100)}%)`);
  }

  if (data.festivalFactor && data.festivalFactor > 1.1) {
    insights.push("Festival period - increased demand expected");
  }

  if (data.eventImpact) {
    insights.push(`Event impact: ${data.eventImpact.description}`);
  }

  return insights;
}

/**
 * Identify risk factors
 */
function identifyRiskFactors(data: any): string[] {
  const risks: string[] = [];

  if (data.confidenceLevel < 70) {
    risks.push("Low confidence forecast - limited historical data");
  }

  if (data.eventImpact && Math.abs(data.eventImpact.impact) > 20) {
    risks.push("Significant event impact - forecast may be volatile");
  }

  return risks;
}
