import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";

const DEMO_TENANT_ID = 1;

// GET /api/pos/favorites
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const userId = parseInt(user.userId) || 1;

    // Get user's favorites
    const favorites = await prisma.posFavorite.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    // Enrich favorites with product/drug data
    const items = await Promise.all(
      favorites.map(async (fav) => {
        if (fav.drugLibraryId) {
          const drug = await prisma.drugLibrary.findUnique({
            where: { id: fav.drugLibraryId },
          });
          if (drug) {
            return {
              id: fav.id,
              drugLibraryId: fav.drugLibraryId,
              name: drug.brandName,
              mrp: drug.priceInr ? parseFloat(drug.priceInr) : undefined,
              isFavorite: true,
            };
          }
        } else if (fav.productId) {
          const product = await prisma.product.findUnique({
            where: { id: fav.productId },
          });
          if (product) {
            return {
              id: fav.id,
              productId: fav.productId,
              name: product.name,
              mrp: product.mrp || product.salePrice || product.unitPrice,
              stockLevel: product.stockLevel,
              isFavorite: true,
            };
          }
        }
        return null;
      })
    );

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error("Error fetching favorites:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch favorites" },
      { status: 500 }
    );
  }
}

// POST /api/pos/favorites/toggle
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const { drugLibraryId, productId } = await req.json();
    const userId = parseInt(user.userId) || 1;

    if (!drugLibraryId && !productId) {
      return NextResponse.json(
        { error: "Either drugLibraryId or productId is required" },
        { status: 400 }
      );
    }

    // Check if favorite exists
    const existing = await prisma.posFavorite.findFirst({
      where: {
        userId,
        drugLibraryId: drugLibraryId || null,
        productId: productId || null,
      },
    });

    if (existing) {
      // Remove favorite
      await prisma.posFavorite.delete({
        where: { id: existing.id },
      });
      return NextResponse.json({ isFavorite: false });
    } else {
      // Add favorite
      await prisma.posFavorite.create({
        data: {
          userId,
          drugLibraryId: drugLibraryId || null,
          productId: productId || null,
        },
      });
      return NextResponse.json({ isFavorite: true });
    }
  } catch (error: any) {
    console.error("Error toggling favorite:", error);
    return NextResponse.json(
      { error: error.message || "Failed to toggle favorite" },
      { status: 500 }
    );
  }
}
