// AI Product Recommendations
// Collaborative filtering and content-based recommendations for pharmacy products

import { prisma } from "@/lib/prisma";

export type RecommendationType = "CROSS_SELL" | "UPSELL" | "SEASONAL" | "GENERIC" | "ALTERNATIVE" | "BUNDLE";

export interface ProductRecommendation {
  productId: number;
  productName: string;
  recommendationType: RecommendationType;
  score: number; // 0-100
  reason: string;
  category?: string;
  pricePaise?: number;
  hsnCode?: string | null;
  gstRate?: number | null;
  // Bundle info
  bundleDiscountPercent?: number;
  // Seasonal/Contextual
  season?: string;
  festival?: string;
}

/**
 * Get product recommendations based on cart items
 */
export async function getProductRecommendations(
  cartItems: Array<{ productId?: number; productName: string; category?: string }>,
  customerId?: number | null,
  tenantId: number = 1
): Promise<ProductRecommendation[]> {
  const recommendations: ProductRecommendation[] = [];

  // Strategy 1: Cross-sell based on purchase history (collaborative filtering)
  if (cartItems.length > 0) {
    // Get products frequently bought together
    const cartProductIds = cartItems.map((item) => item.productId).filter(Boolean) as number[];
    
    if (cartProductIds.length > 0) {
      const frequentlyBoughtTogether = await getFrequentlyBoughtTogether(cartProductIds, tenantId);
      recommendations.push(...frequentlyBoughtTogether);
    }
  }

  // Strategy 2: Seasonal recommendations
  const seasonalRecs = await getSeasonalRecommendations(tenantId);
  recommendations.push(...seasonalRecs);

  // Strategy 3: Generic alternatives for cart items
  if (cartItems.length > 0) {
    const genericAlternatives = await getGenericAlternatives(cartItems, tenantId);
    recommendations.push(...genericAlternatives);
  }

  // Strategy 4: Customer-specific recommendations
  if (customerId) {
    const customerRecs = await getCustomerSpecificRecommendations(customerId, tenantId);
    recommendations.push(...customerRecs);
  }

  // Remove duplicates (same productId) and sort by score
  const uniqueRecs = recommendations.reduce((acc, rec) => {
    const existing = acc.find((r) => r.productId === rec.productId);
    if (!existing || existing.score < rec.score) {
      return acc.filter((r) => r.productId !== rec.productId).concat(rec);
    }
    return acc;
  }, [] as ProductRecommendation[]);

  return uniqueRecs
    .sort((a, b) => b.score - a.score)
    .slice(0, 10); // Top 10 recommendations
}

/**
 * Get products frequently bought together (collaborative filtering)
 */
async function getFrequentlyBoughtTogether(
  productIds: number[],
  tenantId: number
): Promise<ProductRecommendation[]> {
  // Get invoices containing these products
  const coOccurrenceQuery = await prisma.$queryRaw<Array<{
    recommendedProductId: number;
    coOccurrenceCount: bigint;
  }>>`
    SELECT 
      ili2."productId" as "recommendedProductId",
      COUNT(*) as "coOccurrenceCount"
    FROM "InvoiceLineItem" ili1
    INNER JOIN "InvoiceLineItem" ili2 ON ili1."invoiceId" = ili2."invoiceId"
    INNER JOIN "Invoice" inv ON ili1."invoiceId" = inv.id
    WHERE ili1."productId" = ANY(ARRAY[${productIds.join(",")}]::int[])
      AND ili2."productId" != ALL(ARRAY[${productIds.join(",")}]::int[])
      AND ili2."productId" IS NOT NULL
      AND inv."tenantId" = ${tenantId}
      AND inv."createdAt" > NOW() - INTERVAL '90 days'
    GROUP BY ili2."productId"
    ORDER BY "coOccurrenceCount" DESC
    LIMIT 10
  `;

  const recommendations: ProductRecommendation[] = [];

  for (const item of coOccurrenceQuery) {
    const product = await prisma.product.findUnique({
      where: { id: item.recommendedProductId },
      select: {
        id: true,
        name: true,
        category: true,
        salePrice: true,
        hsnCode: true,
        gstRate: true,
      },
    });

    if (product) {
      // Score based on co-occurrence count (normalized)
      const maxCount = Number(coOccurrenceQuery[0]?.coOccurrenceCount || 1);
      const score = Math.min(100, (Number(item.coOccurrenceCount) / maxCount) * 100);

      recommendations.push({
        productId: product.id,
        productName: product.name,
        recommendationType: "CROSS_SELL",
        score,
        reason: `Frequently bought together with items in your cart`,
        category: product.category || undefined,
        pricePaise: product.salePrice ? Math.round(product.salePrice * 100) : undefined,
        hsnCode: product.hsnCode,
        gstRate: product.gstRate ? Number(product.gstRate) : undefined,
      });
    }
  }

  return recommendations;
}

/**
 * Get seasonal recommendations
 */
async function getSeasonalRecommendations(tenantId: number): Promise<ProductRecommendation[]> {
  const recommendations: ProductRecommendation[] = [];
  const month = new Date().getMonth() + 1; // 1-12

  // Determine season
  let season: string = "GENERAL";
  if (month >= 6 && month <= 9) {
    season = "MONSOON"; // June-September
  } else if (month >= 10 || month <= 2) {
    season = "WINTER"; // October-February
  } else {
    season = "SUMMER"; // March-May
  }

  // Get seasonal products (products with high sales in this season)
  const seasonalProducts = await prisma.$queryRaw<Array<{
    productId: number;
    saleCount: bigint;
  }>>`
    SELECT 
      "productId",
      COUNT(*) as "saleCount"
    FROM "InvoiceLineItem"
    INNER JOIN "Invoice" ON "InvoiceLineItem"."invoiceId" = "Invoice".id
    WHERE "productId" IS NOT NULL
      AND "Invoice"."tenantId" = ${tenantId}
      AND EXTRACT(MONTH FROM "Invoice"."createdAt") = ${month}
      AND "Invoice"."createdAt" > NOW() - INTERVAL '2 years'
    GROUP BY "productId"
    ORDER BY "saleCount" DESC
    LIMIT 5
  `;

  for (const item of seasonalProducts) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: {
        id: true,
        name: true,
        category: true,
        salePrice: true,
        hsnCode: true,
        gstRate: true,
      },
    });

    if (product) {
      recommendations.push({
        productId: product.id,
        productName: product.name,
        recommendationType: "SEASONAL",
        score: 75, // Base seasonal score
        reason: `Popular ${season.toLowerCase()} product`,
        season,
        category: product.category || undefined,
        pricePaise: product.salePrice ? Math.round(product.salePrice * 100) : undefined,
        hsnCode: product.hsnCode,
        gstRate: product.gstRate ? Number(product.gstRate) : undefined,
      });
    }
  }

  return recommendations;
}

/**
 * Get generic alternatives for branded products
 */
async function getGenericAlternatives(
  cartItems: Array<{ productName: string; category?: string }>,
  tenantId: number
): Promise<ProductRecommendation[]> {
  const recommendations: ProductRecommendation[] = [];

  // Simple heuristic: Look for products with similar names/categories
  // In production, use drug library composition matching
  
  for (const item of cartItems.slice(0, 3)) { // Limit to 3 items
    // Search for generic alternatives (products with "generic" in name or similar category)
    const alternatives = await prisma.product.findMany({
      where: {
        tenantId,
        category: item.category || undefined,
        name: {
          contains: item.productName.split(" ")[0], // First word of product name
          mode: "insensitive",
        },
        NOT: {
          name: item.productName, // Exclude same product
        },
      },
      take: 2,
      select: {
        id: true,
        name: true,
        category: true,
        salePrice: true,
        hsnCode: true,
        gstRate: true,
      },
    });

    for (const alt of alternatives) {
      recommendations.push({
        productId: alt.id,
        productName: alt.name,
        recommendationType: "GENERIC",
        score: 60,
        reason: `Generic alternative to ${item.productName}`,
        category: alt.category || undefined,
        pricePaise: alt.salePrice ? Math.round(alt.salePrice * 100) : undefined,
        hsnCode: alt.hsnCode,
        gstRate: alt.gstRate ? Number(alt.gstRate) : undefined,
      });
    }
  }

  return recommendations;
}

/**
 * Get customer-specific recommendations based on purchase history
 */
async function getCustomerSpecificRecommendations(
  customerId: number,
  tenantId: number
): Promise<ProductRecommendation[]> {
  const recommendations: ProductRecommendation[] = [];

  // Get customer's purchase history
  const customerInvoices = await prisma.invoice.findMany({
    where: {
      customerId,
      tenantId,
      createdAt: {
        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
      },
    },
    include: {
      lineItems: {
        where: {
          productId: { not: null },
        },
        take: 10,
      },
    },
  });

  // Get frequently purchased categories
  const categoryCounts = new Map<string, number>();
  customerInvoices.forEach((inv) => {
    inv.lineItems.forEach((item) => {
      // Category would need to come from Product relation
      // For now, skip category-based recommendations
    });
  });

  // Get products from same categories (upsell)
  // This is a simplified version - can be enhanced with ML

  return recommendations;
}
