import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { selectBestBatch, getFefoBatches, getFefoBatchesForDrug } from "@/lib/inventory/fefo";
import { getInventoryHealth } from "@/lib/inventory/stock-indicators";
import { autoMapHsn } from "@/lib/hsn/auto-map";

const DEMO_TENANT_ID = 1;

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!q || q.trim().length < 2) {
      return NextResponse.json({ items: [], total: 0 });
    }

    const searchTerm = q.trim().toLowerCase();

    // Search in drug library
    const drugs = await prisma.drugLibrary.findMany({
      where: {
        OR: [
          { brandName: { contains: searchTerm, mode: "insensitive" } },
          { brandNameNorm: { contains: searchTerm, mode: "insensitive" } },
          { manufacturer: { contains: searchTerm, mode: "insensitive" } },
          { salts: { contains: searchTerm, mode: "insensitive" } },
        ],
        isDiscontinued: false,
      },
      take: limit,
      orderBy: [
        { brandName: "asc" },
      ],
    });

    // Enrich with inventory data and stock indicators
    const items = await Promise.all(
      drugs.map(async (drug) => {
        // Get inventory items for this drug
        const inventoryItems = await prisma.inventoryItem.findMany({
          where: {
            drugLibraryId: drug.id,
            tenantId: DEMO_TENANT_ID,
            qtyOnHand: { gt: 0 },
          },
          orderBy: [
            { expiryDate: "asc" }, // FEFO
          ],
        });

        const totalQty = inventoryItems.reduce((sum, item) => sum + item.qtyOnHand, 0);
        const earliestExpiry = inventoryItems.length > 0 ? inventoryItems[0].expiryDate : null;

        // Get best batch (FEFO)
        const bestBatch = await selectBestBatch(
          undefined,
          drug.id,
          1,
          DEMO_TENANT_ID,
          null
        );

        // Get stock health
        const health = getInventoryHealth(
          totalQty,
          earliestExpiry,
          5 // Default low stock threshold
        );

        // Try HSN auto-mapping (hsnCode field not available in database)
        let hsnSuggestion = null;
        // Always try auto-mapping since hsnCode column doesn't exist in drug_library table
        hsnSuggestion = await autoMapHsn(
          drug.brandName,
          drug.category || null,
          drug.salts || null,
          drug.brandName
        );

        return {
          id: drug.id,
          type: "drug",
          drugLibraryId: drug.id,
          name: drug.brandName,
          manufacturer: drug.manufacturer,
          category: drug.category,
          salts: drug.salts,
          priceInr: drug.priceInr,
          mrp: drug.dpcoCeilingPriceInr || (drug.priceInr ? parseFloat(drug.priceInr) : null),
          hsnCode: null, // hsnCode column doesn't exist in drug_library table
          gstRate: drug.gstPercent || null,
          taxCategory: drug.taxCategory || "TAXABLE",
          isScheduleDrug: drug.isScheduleDrug || false,
          schedule: drug.schedule,
          // Inventory info
          stockQuantity: totalQty,
          stockStatus: health.stock.status,
          expiryStatus: health.expiry?.status || null,
          daysToExpiry: health.expiry?.daysToExpiry || null,
          needsAttention: health.needsAttention,
          // Batch info
          bestBatch: bestBatch
            ? {
                id: bestBatch.id,
                batchCode: bestBatch.batchCode,
                expiryDate: bestBatch.expiryDate.toISOString(),
                daysToExpiry: bestBatch.daysToExpiry,
                quantityOnHand: bestBatch.quantityOnHand,
                suggestedDiscount: bestBatch.nearExpiryDiscountPct
                  ? {
                      percent: bestBatch.nearExpiryDiscountPct,
                      reason: `Near expiry (${bestBatch.daysToExpiry} days)`,
                    }
                  : null,
              }
            : null,
          // HSN suggestion
          hsnSuggestion,
        };
      })
    );

    return NextResponse.json({
      items,
      total: items.length,
      limit,
    });
  } catch (error: any) {
    console.error("Drug search error:", error);
    return NextResponse.json(
      { error: error.message || "Search failed" },
      { status: 500 }
    );
  }
}
