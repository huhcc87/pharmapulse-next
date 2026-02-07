// Reorder point (ROP) and recommended order quantity (ROQ) calculation

export interface ReorderPointInput {
  avgDailyDemand: number;
  leadTimeDays: number; // Supplier lead time
  safetyStock: number; // Days of safety stock
  currentStock: number;
  serviceLevel?: number; // Service level (0-1), default 0.95 (95%)
  minOrderQuantity?: number; // MOQ from supplier
}

export interface ReorderPointResult {
  reorderPoint: number; // ROP = (Avg Daily Demand × Lead Time) + Safety Stock
  recommendedOrderQty: number; // ROQ = Max(ROP - Current Stock, MOQ)
  stockCoverDays: number; // How many days current stock will last
  safetyStockDays: number;
  explanation: string;
}

/**
 * Calculate reorder point and recommended order quantity
 */
export function calculateReorderPoint(input: ReorderPointInput): ReorderPointResult {
  const {
    avgDailyDemand,
    leadTimeDays,
    safetyStock,
    currentStock,
    serviceLevel = 0.95,
    minOrderQuantity = 0,
  } = input;

  // Safety stock in units (convert days to units)
  const safetyStockUnits = Math.ceil(avgDailyDemand * safetyStock);

  // Reorder point: ROP = (Avg Daily Demand × Lead Time) + Safety Stock
  const reorderPoint = Math.ceil(avgDailyDemand * leadTimeDays) + safetyStockUnits;

  // Stock cover days: how many days current stock will last
  const stockCoverDays = avgDailyDemand > 0 ? Math.floor(currentStock / avgDailyDemand) : 0;

  // Recommended order quantity
  // If current stock is below ROP, order enough to reach ROP plus some buffer
  const stockDeficit = Math.max(0, reorderPoint - currentStock);
  let recommendedOrderQty = stockDeficit;

  // Ensure minimum order quantity
  if (recommendedOrderQty < minOrderQuantity) {
    recommendedOrderQty = minOrderQuantity;
  }

  // If stock is already above ROP, no order needed (but still calculate for reference)
  if (currentStock >= reorderPoint) {
    recommendedOrderQty = 0;
  }

  // Add buffer for service level (additional safety margin)
  if (serviceLevel > 0.95) {
    recommendedOrderQty = Math.ceil(recommendedOrderQty * 1.1); // 10% buffer
  }

  const explanation = `Reorder Point: ${reorderPoint} units (${leadTimeDays} days lead time + ${safetyStock} days safety stock). ` +
    `Current stock: ${currentStock} units (${stockCoverDays} days cover). ` +
    (recommendedOrderQty > 0
      ? `Recommended order: ${recommendedOrderQty} units.`
      : `Stock is sufficient. No reorder needed.`);

  return {
    reorderPoint,
    recommendedOrderQty,
    stockCoverDays,
    safetyStockDays: safetyStock,
    explanation,
  };
}

/**
 * Calculate safety stock based on service level and demand variability
 */
export function calculateSafetyStock(
  avgDailyDemand: number,
  demandStdDev: number,
  leadTimeDays: number,
  serviceLevel: number = 0.95
): number {
  // Z-score for service level (95% = 1.65, 99% = 2.33)
  const zScores: Record<number, number> = {
    0.9: 1.28,
    0.95: 1.65,
    0.99: 2.33,
  };
  const zScore = zScores[serviceLevel] || 1.65;

  // Safety stock = Z × √(Lead Time) × Demand Std Dev
  const safetyStock = zScore * Math.sqrt(leadTimeDays) * demandStdDev;

  return Math.ceil(safetyStock);
}
