// POST /api/offline/preload-cache
// Pre-load product cache for offline barcode scanning
// Accepts product IDs or barcodes, returns product data for caching

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_PRODUCTS_PER_REQUEST = 1000;

function toUpperRole(role: any): string {
  return String(role ?? "").toUpperCase();
}

/**
 * Your Prisma Product model does NOT have `tenantId` (previous error),
 * and also does NOT have `drugLibraryId` (current error).
 * This route is now written to compile without those fields.
 *
 * If you have a tenancy scoping field (orgId/storeId/pharmacyId), add it here.
 */
function productScopeWhere(_user: any) {
  // TODO: Replace with your real scoping field if available:
  // return { orgId: Number(_user.orgId) };
  return {};
}

const PRODUCT_SELECT = {
  id: true,
  name: true,
  salePrice: true,
  unitPrice: true,
  mrp: true,
  hsnCode: true,
  gstRate: true,
  gstType: true,
  barcode: true,
  barcodeValue: true,
  internalCode: true,
  category: true,
  stockLevel: true,
  // ✅ removed drugLibraryId (does not exist on Product)
} as const;

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const allowedRoles = ["OWNER", "ADMIN", "SUPER_ADMIN"];
    const userRole = toUpperRole(user.role);

    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { error: "Access denied. Only Owner/Admin can pre-load cache." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { productIds, barcodes, strategy = "POPULAR" } = body ?? {};

    const scopeWhere = productScopeWhere(user);

    let products: any[] = [];

    // Strategy 1: Pre-load by product IDs
    if (Array.isArray(productIds) && productIds.length > 0) {
      const limitedIds = productIds.slice(0, MAX_PRODUCTS_PER_REQUEST);

      products = await prisma.product.findMany({
        where: {
          ...scopeWhere,
          id: { in: limitedIds },
        },
        select: PRODUCT_SELECT,
      });
    }

    // Strategy 2: Pre-load by barcodes
    else if (Array.isArray(barcodes) && barcodes.length > 0) {
      const limitedBarcodes = barcodes.slice(0, MAX_PRODUCTS_PER_REQUEST);

      products = await prisma.product.findMany({
        where: {
          ...scopeWhere,
          OR: [
            { barcode: { in: limitedBarcodes } },
            { barcodeValue: { in: limitedBarcodes } },
            { internalCode: { in: limitedBarcodes } },
          ],
        },
        select: PRODUCT_SELECT,
      });
    }

    // Strategy 3: POPULAR / FAST_MOVING
    else if (strategy === "POPULAR" || strategy === "FAST_MOVING") {
      const topProducts =
        await prisma.$queryRaw<Array<{ productId: number; saleCount: bigint }>>`
          SELECT 
            "productId",
            COUNT(*) as "saleCount"
          FROM "InvoiceLineItem"
          WHERE "productId" IS NOT NULL
            AND "createdAt" > NOW() - INTERVAL '30 days'
          GROUP BY "productId"
          ORDER BY "saleCount" DESC
          LIMIT ${MAX_PRODUCTS_PER_REQUEST}
        `;

      const productIdsFromSales = topProducts.map((p) => p.productId);

      if (productIdsFromSales.length > 0) {
        products = await prisma.product.findMany({
          where: {
            ...scopeWhere,
            id: { in: productIdsFromSales },
          },
          select: PRODUCT_SELECT,
        });
      }

      // If not enough products from sales, add products with barcodes
      if (products.length < 100) {
        const additionalProducts = await prisma.product.findMany({
          where: {
            ...scopeWhere,
            OR: [{ barcode: { not: null } }, { barcodeValue: { not: null } }],
            NOT: { id: { in: products.map((p) => p.id) } },
          },
          take: Math.max(0, MAX_PRODUCTS_PER_REQUEST - products.length),
          select: PRODUCT_SELECT,
        });

        products = [...products, ...additionalProducts];
      }
    }

    // Strategy 4: ALL_WITH_BARCODE
    else if (strategy === "ALL_WITH_BARCODE") {
      products = await prisma.product.findMany({
        where: {
          ...scopeWhere,
          OR: [{ barcode: { not: null } }, { barcodeValue: { not: null } }],
        },
        take: MAX_PRODUCTS_PER_REQUEST,
        select: PRODUCT_SELECT,
      });
    }

    // Format products for caching (ensure barcode is present)
    const cacheableProducts = products
      .filter((p) => p.barcode || p.barcodeValue || p.internalCode)
      .map((product) => {
        const barcode =
          product.barcode || product.barcodeValue || product.internalCode;

        return {
          barcode: barcode || "",
          product: {
            id: product.id,
            name: product.name,
            salePrice: product.salePrice,
            unitPrice: product.unitPrice,
            mrp: product.mrp,
            hsnCode: product.hsnCode,
            gstRate: product.gstRate ? Number(product.gstRate) : null,
            gstType: product.gstType,
            barcode: product.barcode,
            barcodeValue: product.barcodeValue,
            internalCode: product.internalCode,
            category: product.category,
            stockLevel: product.stockLevel,

            // ✅ keep key for frontend compatibility, but set null
            drugLibraryId: null,
          },
        };
      });

    return NextResponse.json({
      success: true,
      products: cacheableProducts,
      count: cacheableProducts.length,
      strategy: strategy || "CUSTOM",
      message: `Pre-loaded ${cacheableProducts.length} products for offline cache`,
    });
  } catch (error: any) {
    console.error("Preload cache error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to pre-load cache" },
      { status: 500 }
    );
  }
}

// GET /api/offline/preload-cache - Get cache information
export async function GET(_req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    return NextResponse.json({
      success: true,
      message:
        "Use POST to pre-load cache. Cache statistics are managed client-side in IndexedDB.",
      strategies: [
        "POPULAR - Pre-load fast-moving products (last 30 days sales)",
        "FAST_MOVING - Same as POPULAR",
        "ALL_WITH_BARCODE - Pre-load all products with barcodes",
        "CUSTOM - Specify productIds or barcodes in request body",
      ],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to get cache info" },
      { status: 500 }
    );
  }
}
