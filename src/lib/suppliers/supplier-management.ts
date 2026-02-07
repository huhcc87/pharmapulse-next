// Supplier Management System
// Rate contracts, PO automation, supplier performance tracking

import { prisma } from "@/lib/prisma";

export interface SupplierPerformanceMetrics {
  supplierId: number;
  totalOrders: number;
  totalValue: number;
  averageDeliveryTime: number; // days
  onTimeDeliveryRate: number; // percentage
  qualityScore: number; // 0-100
  priceCompetitiveness: number; // 0-100
  paymentTerms: string;
  paymentAging: number; // days
  rating: number; // 1-5
}

export interface RateContractInfo {
  vendorId: number;
  productId?: number;
  drugLibraryId?: number;
  rate: number; // in paise
  validFrom: Date;
  validTo: Date;
  minQuantity?: number;
  discountPercent?: number;
}

/**
 * Get supplier performance metrics
 */
export async function getSupplierPerformance(
  supplierId: number,
  tenantId: number = 1
): Promise<SupplierPerformanceMetrics> {
  // Get purchase orders
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: {
      vendorId: supplierId,
      tenantId,
      status: { in: ['RECEIVED', 'PARTIALLY_RECEIVED'] },
    },
    include: {
      grns: {
        where: {
          status: 'RECEIVED',
        },
      },
    },
  });

  const totalOrders = purchaseOrders.length;
  const totalValue = purchaseOrders.reduce(
    (sum, po) => sum + po.totalAmountPaise,
    0
  );

  // Calculate average delivery time
  const deliveryTimes: number[] = [];
  for (const po of purchaseOrders) {
    if (po.expectedDate && po.grns.length > 0) {
      const grnDate = po.grns[0].grnDate;
      const daysDiff = Math.floor(
        (grnDate.getTime() - po.expectedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      deliveryTimes.push(daysDiff);
    }
  }

  const averageDeliveryTime =
    deliveryTimes.length > 0
      ? deliveryTimes.reduce((sum, days) => sum + days, 0) / deliveryTimes.length
      : 0;

  // Calculate on-time delivery rate
  const onTimeDeliveries = deliveryTimes.filter((days) => days <= 0).length;
  const onTimeDeliveryRate =
    deliveryTimes.length > 0 ? (onTimeDeliveries / deliveryTimes.length) * 100 : 0;

  // Quality score (based on returns/rejections)
  const returns = await prisma.purchaseReturn.count({
    where: {
      purchaseOrder: {
        vendorId: supplierId,
        tenantId,
      },
    },
  });

  const qualityScore = Math.max(
    0,
    100 - (returns / totalOrders) * 100
  );

  // Price competitiveness (compare with other vendors)
  const priceCompetitiveness = await calculatePriceCompetitiveness(
    supplierId,
    tenantId
  );

  // Payment aging
  const paymentAging = await calculatePaymentAging(supplierId, tenantId);

  // Overall rating
  const rating = calculateRating({
    onTimeDeliveryRate,
    qualityScore,
    priceCompetitiveness,
    paymentAging,
  });

  return {
    supplierId,
    totalOrders,
    totalValue,
    averageDeliveryTime,
    onTimeDeliveryRate,
    qualityScore,
    priceCompetitiveness,
    paymentTerms: 'NET_30', // Would come from vendor record
    paymentAging,
    rating,
  };
}

/**
 * Get rate contract for product
 */
export async function getRateContract(
  productId: number | undefined,
  drugLibraryId: number | undefined,
  vendorId: number,
  tenantId: number = 1
): Promise<RateContractInfo | null> {
  const rateContract = await prisma.rateContract.findFirst({
    where: {
      vendorId,
      tenantId,
      ...(productId ? { productId } : {}),
      ...(drugLibraryId ? { drugLibraryId } : {}),
      validFrom: { lte: new Date() },
      validTo: { gte: new Date() },
    },
    orderBy: {
      validFrom: 'desc',
    },
  });

  if (!rateContract) return null;

  return {
    vendorId: rateContract.vendorId,
    productId: rateContract.productId || undefined,
    drugLibraryId: rateContract.drugLibraryId || undefined,
    rate: rateContract.ratePaise,
    validFrom: rateContract.validFrom,
    validTo: rateContract.validTo,
    minQuantity: rateContract.minQuantity || undefined,
    discountPercent: rateContract.discountPercent
      ? Number(rateContract.discountPercent)
      : undefined,
  };
}

/**
 * Auto-generate PO from low stock alerts
 */
export async function autoGeneratePO(
  tenantId: number = 1
): Promise<Array<{ productId?: number; drugLibraryId?: number; quantity: number; suggestedVendorId: number }>> {
  // Get low stock items
  const lowStockItems = await prisma.product.findMany({
    where: {
      stockLevel: { lte: prisma.product.fields.minStock },
      isActive: true,
    },
  });

  const suggestions: Array<{
    productId?: number;
    drugLibraryId?: number;
    quantity: number;
    suggestedVendorId: number;
  }> = [];

  for (const product of lowStockItems) {
    // Calculate reorder quantity
    const reorderQty = product.minStock * 2 - product.stockLevel;

    // Find best vendor (based on rate contract, performance)
    const bestVendor = await findBestVendor(product.id, undefined, tenantId);

    if (bestVendor) {
      suggestions.push({
        productId: product.id,
        quantity: reorderQty,
        suggestedVendorId: bestVendor.id,
      });
    }
  }

  return suggestions;
}

/**
 * Find best vendor for a product
 */
async function findBestVendor(
  productId: number | undefined,
  drugLibraryId: number | undefined,
  tenantId: number
): Promise<{ id: number; score: number } | null> {
  // Get all vendors with rate contracts for this product
  const vendors = await prisma.vendor.findMany({
    where: {
      tenantId,
      isActive: true,
      rateContracts: {
        some: {
          ...(productId ? { productId } : {}),
          ...(drugLibraryId ? { drugLibraryId } : {}),
          validFrom: { lte: new Date() },
          validTo: { gte: new Date() },
        },
      },
    },
    include: {
      rateContracts: {
        where: {
          ...(productId ? { productId } : {}),
          ...(drugLibraryId ? { drugLibraryId } : {}),
          validFrom: { lte: new Date() },
          validTo: { gte: new Date() },
        },
      },
    },
  });

  if (vendors.length === 0) return null;

  // Score vendors based on price, performance, delivery time
  const scoredVendors = await Promise.all(
    vendors.map(async (vendor) => {
      const performance = await getSupplierPerformance(vendor.id, tenantId);
      const rateContract = vendor.rateContracts[0];
      const price = rateContract?.ratePaise || 0;

      // Score: lower price = higher score, better performance = higher score
      const priceScore = 100; // Would compare with market average
      const performanceScore = performance.rating * 20; // Convert 1-5 to 0-100
      const deliveryScore = performance.onTimeDeliveryRate;

      const totalScore = (priceScore * 0.4) + (performanceScore * 0.4) + (deliveryScore * 0.2);

      return {
        id: vendor.id,
        score: totalScore,
      };
    })
  );

  // Return vendor with highest score
  scoredVendors.sort((a, b) => b.score - a.score);
  return scoredVendors[0];
}

/**
 * Calculate price competitiveness
 */
async function calculatePriceCompetitiveness(
  supplierId: number,
  tenantId: number
): Promise<number> {
  // Compare supplier prices with market average
  // For now, return a default score
  return 75; // Would be calculated based on actual price comparison
}

/**
 * Calculate payment aging
 */
async function calculatePaymentAging(
  supplierId: number,
  tenantId: number
): Promise<number> {
  // Calculate average days to payment
  // For now, return default
  return 30; // Would be calculated from actual payment data
}

/**
 * Calculate overall rating
 */
function calculateRating(metrics: {
  onTimeDeliveryRate: number;
  qualityScore: number;
  priceCompetitiveness: number;
  paymentAging: number;
}): number {
  // Weighted average
  const score =
    metrics.onTimeDeliveryRate * 0.3 +
    metrics.qualityScore * 0.3 +
    metrics.priceCompetitiveness * 0.2 +
    (metrics.paymentAging <= 30 ? 100 : 50) * 0.2;

  // Convert to 1-5 scale
  return Math.min(5, Math.max(1, Math.round(score / 20)));
}

/**
 * Compare vendors for a product
 */
export async function compareVendors(
  productId: number | undefined,
  drugLibraryId: number | undefined,
  tenantId: number = 1
): Promise<Array<{
  vendorId: number;
  vendorName: string;
  rate: number;
  performance: SupplierPerformanceMetrics;
  recommendation: 'BEST_PRICE' | 'BEST_PERFORMANCE' | 'BEST_VALUE' | 'NONE';
}>> {
  const vendors = await prisma.vendor.findMany({
    where: {
      tenantId,
      isActive: true,
      rateContracts: {
        some: {
          ...(productId ? { productId } : {}),
          ...(drugLibraryId ? { drugLibraryId } : {}),
          validFrom: { lte: new Date() },
          validTo: { gte: new Date() },
        },
      },
    },
    include: {
      rateContracts: {
        where: {
          ...(productId ? { productId } : {}),
          ...(drugLibraryId ? { drugLibraryId } : {}),
          validFrom: { lte: new Date() },
          validTo: { gte: new Date() },
        },
      },
    },
  });

  const comparisons = await Promise.all(
    vendors.map(async (vendor) => {
      const performance = await getSupplierPerformance(vendor.id, tenantId);
      const rateContract = vendor.rateContracts[0];
      const rate = rateContract?.ratePaise || 0;

      // Determine recommendation
      let recommendation: 'BEST_PRICE' | 'BEST_PERFORMANCE' | 'BEST_VALUE' | 'NONE' = 'NONE';
      // Logic would compare with other vendors

      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        rate,
        performance,
        recommendation,
      };
    })
  );

  return comparisons;
}
