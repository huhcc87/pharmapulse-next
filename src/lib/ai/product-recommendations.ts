// src/lib/ai/product-recommendations.ts
// AI Product Recommendations
// Collaborative filtering and content-based recommendations for pharmacy products

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type RecommendationType =
  | "CROSS_SELL"
  | "UPSELL"
  | "SEASONAL"
  | "GENERIC"
  | "ALTERNATIVE"
  | "BUNDLE";

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

  bundleDiscountPercent?: number;

  season?: string;
  festival?: string;
}

function firstToken(name: string): string {
  const t = name.split(/\s+/).filter(Boolean)[0];
  return (t ?? name).trim();
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

  // Strategy 1: Cross-sell (invoice co-occurrence)
  if (cartItems.length > 0) {
    const cartProductIds = cartItems
      .map((i) => i.productId)
      .filter((v): v is number => typeof v === "number");

    if (cartProductIds.length > 0) {
      recommendations.push(...(await getFrequentlyBoughtTogether(cartProductIds, tenantId)));
    }
  }

  // Strategy 2: Seasonal recommendations
  recommendations.push(...(await getSeasonalRecommendations(tenantId)));

  // Strategy 3: Generic alternatives
  if (cartItems.length > 0) {
    recommendations.push(...(await getGenericAlternatives(cartItems)));
  }

  // Strategy 4: Customer-specific (placeholder)
  if (customerId) {
    recommendations.push(...(await getCustomerSpecificRecommendations(customerId, tenantId)));
  }

  // De-dupe by productId, keep highest score
  const byId = new Map<number, ProductRecommendation>();
  for (const rec of recommendations) {
    const prev = byId.get(rec.productId);
    if (!prev || rec.score > prev.score) byId.set(rec.productId, rec);
  }

  return Array.from(byId.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

/**
 * Collaborative filtering: products frequently bought together
 */
async function getFrequentlyBoughtTogether(
  productIds: number[],
  tenantId: number
): Promise<ProductRecommendation[]> {
  if (productIds.length === 0) return [];

  const rows = await prisma.$queryRaw<
    Array<{ recommendedProductId: number; coOccurrenceCount: bigint }>
  >(Prisma.sql`
    SELECT 
      ili2."productId" as "recommendedProductId",
      COUNT(*) as "coOccurrenceCount"
    FROM "InvoiceLineItem" ili1
    INNER JOIN "InvoiceLineItem" ili2 ON ili1."invoiceId" = ili2."invoiceId"
    INNER JOIN "Invoice" inv ON ili1."invoiceId" = inv.id
    WHERE ili1."productId" IN (${Prisma.join(productIds)})
      AND ili2."productId" NOT IN (${Prisma.join(productIds)})
      AND ili2."productId" IS NOT NULL
      AND inv."tenantId" = ${tenantId}
      AND inv."createdAt" > NOW() - INTERVAL '90 days'
    GROUP BY ili2."productId"
    ORDER BY "coOccurrenceCount" DESC
    LIMIT 10
  `);

  const recommendations: ProductRecommendation[] = [];
  const maxCount = Number(rows[0]?.coOccurrenceCount ?? 1);

  for (const item of rows) {
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

    if (!product) continue;

    const score = Math.min(100, (Number(item.coOccurrenceCount) / maxCount) * 100);

    recommendations.push({
      productId: product.id,
      productName: product.name,
      recommendationType: "CROSS_SELL",
      score,
      reason: "Frequently bought together with items in your cart",
      category: product.category ?? undefined,
      pricePaise: product.salePrice ? Math.round(product.salePrice * 100) : undefined,
      hsnCode: product.hsnCode,
      gstRate: product.gstRate ? Number(product.gstRate) : undefined,
    });
  }

  return recommendations;
}

/**
 * Seasonal recommendations (based on invoice history for the current month)
 */
async function getSeasonalRecommendations(tenantId: number): Promise<ProductRecommendation[]> {
  const month = new Date().getMonth() + 1;

  let season = "GENERAL";
  if (month >= 6 && month <= 9) season = "MONSOON";
  else if (month >= 10 || month <= 2) season = "WINTER";
  else season = "SUMMER";

  const rows = await prisma.$queryRaw<Array<{ productId: number; saleCount: bigint }>>(
    Prisma.sql`
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
    `
  );

  const recommendations: ProductRecommendation[] = [];

  for (const item of rows) {
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

    if (!product) continue;

    recommendations.push({
      productId: product.id,
      productName: product.name,
      recommendationType: "SEASONAL",
      score: 75,
      reason: `Popular ${season.toLowerCase()} product`,
      season,
      category: product.category ?? undefined,
      pricePaise: product.salePrice ? Math.round(product.salePrice * 100) : undefined,
      hsnCode: product.hsnCode,
      gstRate: product.gstRate ? Number(product.gstRate) : undefined,
    });
  }

  return recommendations;
}

/**
 * Generic alternatives (catalog heuristic)
 *
 * IMPORTANT:
 * Your Product model does NOT have tenantId, so we cannot filter Product by tenantId.
 * Tenant filtering should be applied via Store/Location if your schema supports it.
 */
async function getGenericAlternatives(
  cartItems: Array<{ productName: string; category?: string }>
): Promise<ProductRecommendation[]> {
  const recommendations: ProductRecommendation[] = [];

  for (const item of cartItems.slice(0, 3)) {
    const token = firstToken(item.productName);

    const alternatives = await prisma.product.findMany({
      where: {
        category: item.category ?? undefined,
        name: { contains: token, mode: "insensitive" },
        NOT: { name: item.productName },
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
        category: alt.category ?? undefined,
        pricePaise: alt.salePrice ? Math.round(alt.salePrice * 100) : undefined,
        hsnCode: alt.hsnCode,
        gstRate: alt.gstRate ? Number(alt.gstRate) : undefined,
      });
    }
  }

  return recommendations;
}

/**
 * Customer-specific recommendations (placeholder)
 */
async function getCustomerSpecificRecommendations(
  customerId: number,
  tenantId: number
): Promise<ProductRecommendation[]> {
  await prisma.invoice.findMany({
    where: {
      customerId,
      tenantId,
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
    take: 1,
    select: { id: true },
  });

  return [];
}
