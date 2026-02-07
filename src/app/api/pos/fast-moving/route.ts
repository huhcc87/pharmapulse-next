import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";

const DEMO_TENANT_ID = 1;

// GET /api/pos/fast-moving
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    // Get top 20 fast-moving items from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get line items from invoices in last 30 days
    const lineItems = await prisma.invoiceLineItem.findMany({
      where: {
        invoice: {
          tenantId: DEMO_TENANT_ID,
          invoiceDate: {
            gte: thirtyDaysAgo,
          },
          status: "ISSUED",
        },
      },
      select: {
        drugLibraryId: true,
        productId: true,
        productName: true,
        quantity: true,
      },
    });

    // Aggregate by drug/product
    const itemCounts = new Map<
      string,
      { name: string; quantity: number; drugLibraryId?: number; productId?: number }
    >();

    for (const item of lineItems) {
      const key = item.drugLibraryId
        ? `drug-${item.drugLibraryId}`
        : `product-${item.productId}`;

      const existing = itemCounts.get(key) || {
        name: item.productName,
        quantity: 0,
        drugLibraryId: item.drugLibraryId || undefined,
        productId: item.productId || undefined,
      };

      existing.quantity += item.quantity;
      itemCounts.set(key, existing);
    }

    // Sort by quantity and take top 20
    const topItems = Array.from(itemCounts.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 20);

    // Enrich with product/drug library data
    const items = await Promise.all(
      topItems.map(async (item) => {
        if (item.drugLibraryId) {
          const drug = await prisma.drugLibrary.findUnique({
            where: { id: item.drugLibraryId },
          });
          return {
            id: item.drugLibraryId,
            drugLibraryId: item.drugLibraryId,
            name: drug?.brandName || item.name,
            mrp: drug?.priceInr ? parseFloat(drug.priceInr) : undefined,
            quantity: item.quantity,
            isFavorite: false,
          };
        } else if (item.productId) {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
          });
          return {
            id: item.productId,
            productId: item.productId,
            name: product?.name || item.name,
            mrp: product?.mrp || product?.salePrice || product?.unitPrice,
            stockLevel: product?.stockLevel,
            quantity: item.quantity,
            isFavorite: false,
          };
        }
        return null;
      })
    );

    return NextResponse.json({ items: items.filter(Boolean) });
  } catch (error: any) {
    console.error("Error fetching fast-moving items:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch fast-moving items" },
      { status: 500 }
    );
  }
}
