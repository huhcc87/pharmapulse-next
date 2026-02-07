// POST /api/offline/preload-cache
// Pre-load product cache for offline barcode scanning
// Accepts product IDs or barcodes, returns product data for caching

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;
const MAX_PRODUCTS_PER_REQUEST = 1000; // Limit bulk requests

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    // Only Owner/Admin can trigger bulk cache pre-load
    const allowedRoles = ["OWNER", "ADMIN", "SUPER_ADMIN"];
    const userRole = user.role.toUpperCase();
    
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { error: "Access denied. Only Owner/Admin can pre-load cache." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { productIds, barcodes, strategy = "POPULAR" } = body;

    let products: any[] = [];

    // Strategy 1: Pre-load by product IDs
    if (productIds && Array.isArray(productIds) && productIds.length > 0) {
      const limitedIds = productIds.slice(0, MAX_PRODUCTS_PER_REQUEST);
      const found = await prisma.product.findMany({
        where: {
          id: { in: limitedIds },
          tenantId: user.tenantId || DEMO_TENANT_ID,
        },
        select: {
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
          drugLibraryId: true,
        },
      });
      products = found;
    }
    // Strategy 2: Pre-load by barcodes
    else if (barcodes && Array.isArray(barcodes) && barcodes.length > 0) {
      const limitedBarcodes = barcodes.slice(0, MAX_PRODUCTS_PER_REQUEST);
      const found = await prisma.product.findMany({
        where: {
          OR: [
            { barcode: { in: limitedBarcodes } },
            { barcodeValue: { in: limitedBarcodes } },
            { internalCode: { in: limitedBarcodes } },
          ],
          tenantId: user.tenantId || DEMO_TENANT_ID,
        },
        select: {
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
          drugLibraryId: true,
        },
      });
      products = found;
    }
    // Strategy 3: Pre-load popular/fast-moving products
    else if (strategy === "POPULAR" || strategy === "FAST_MOVING") {
      // Get products with most sales (from invoice line items)
      const topProducts = await prisma.$queryRaw<Array<{ productId: number; saleCount: bigint }>>`
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
            id: { in: productIdsFromSales },
            tenantId: user.tenantId || DEMO_TENANT_ID,
          },
          select: {
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
            drugLibraryId: true,
          },
        });
      }

      // If not enough products from sales, add products with barcodes
      if (products.length < 100) {
        const additionalProducts = await prisma.product.findMany({
          where: {
            OR: [
              { barcode: { not: null } },
              { barcodeValue: { not: null } },
            ],
            tenantId: user.tenantId || DEMO_TENANT_ID,
            NOT: {
              id: { in: products.map((p) => p.id) },
            },
          },
          take: MAX_PRODUCTS_PER_REQUEST - products.length,
          select: {
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
            drugLibraryId: true,
          },
        });
        products = [...products, ...additionalProducts];
      }
    }
    // Strategy 4: Pre-load all products with barcodes
    else if (strategy === "ALL_WITH_BARCODE") {
      products = await prisma.product.findMany({
        where: {
          OR: [
            { barcode: { not: null } },
            { barcodeValue: { not: null } },
          ],
          tenantId: user.tenantId || DEMO_TENANT_ID,
        },
        take: MAX_PRODUCTS_PER_REQUEST,
        select: {
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
          drugLibraryId: true,
        },
      });
    }

    // Format products for caching (ensure barcode is present)
    const cacheableProducts = products
      .filter((p) => p.barcode || p.barcodeValue || p.internalCode)
      .map((product) => {
        const barcode = product.barcode || product.barcodeValue || product.internalCode;
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
            drugLibraryId: product.drugLibraryId,
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
      { error: error.message || "Failed to pre-load cache" },
      { status: 500 }
    );
  }
}

// GET /api/offline/preload-cache - Get cache statistics
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    // Return cache statistics (client-side only - this is informational)
    return NextResponse.json({
      success: true,
      message: "Use POST to pre-load cache. Cache statistics are managed client-side in IndexedDB.",
      strategies: [
        "POPULAR - Pre-load fast-moving products (last 30 days sales)",
        "FAST_MOVING - Same as POPULAR",
        "ALL_WITH_BARCODE - Pre-load all products with barcodes",
        "CUSTOM - Specify productIds or barcodes in request body",
      ],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to get cache info" },
      { status: 500 }
    );
  }
}
