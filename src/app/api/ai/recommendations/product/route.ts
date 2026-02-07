// GET/POST /api/ai/recommendations/product
// Get AI-powered product recommendations

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { getProductRecommendations } from "@/lib/ai/product-recommendations";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId") ? parseInt(searchParams.get("customerId")!) : null;
    const cartItemsJson = searchParams.get("cartItems");

    let cartItems: Array<{ productId?: number; productName: string; category?: string }> = [];

    if (cartItemsJson) {
      try {
        cartItems = JSON.parse(cartItemsJson);
      } catch (e) {
        // Invalid JSON, ignore
      }
    }

    const recommendations = await getProductRecommendations(
      cartItems,
      customerId || undefined,
      user.tenantId || DEMO_TENANT_ID
    );

    return NextResponse.json({
      success: true,
      recommendations,
      count: recommendations.length,
    });
  } catch (error: any) {
    console.error("Product recommendations error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get recommendations" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { cartItems, customerId } = body;

    const recommendations = await getProductRecommendations(
      cartItems || [],
      customerId || undefined,
      user.tenantId || DEMO_TENANT_ID
    );

    // Optionally save recommendation tracking
    if (cartItems && cartItems.length > 0) {
      // Track recommendations shown (for ML model improvement)
      // This can be async and non-blocking
      Promise.all(
        recommendations.map((rec) =>
          prisma.aIProductRecommendation.create({
            data: {
              tenantId: user.tenantId || DEMO_TENANT_ID,
              sourceProductId: cartItems[0]?.productId || null,
              recommendedProductId: rec.productId,
              customerId: customerId || null,
              recommendationType: rec.recommendationType,
              score: rec.score,
              reason: rec.reason || null,
              season: rec.season || null,
            },
          }).catch(() => {
            // Ignore errors - tracking is optional
          })
        )
      ).catch(() => {
        // Ignore errors
      });
    }

    return NextResponse.json({
      success: true,
      recommendations,
      count: recommendations.length,
    });
  } catch (error: any) {
    console.error("Product recommendations error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get recommendations" },
      { status: 500 }
    );
  }
}
