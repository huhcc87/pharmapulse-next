// GET/POST /api/ai/recommendations/product
// Get AI-powered product recommendations

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { getProductRecommendations } from "@/lib/ai/product-recommendations";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

function resolveTenantId(user: any): number {
  const raw = user?.tenantId;

  // If already a number (or 1), use it
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;

  // If it's a string, coerce to number
  if (typeof raw === "string") {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }

  return DEMO_TENANT_ID;
}

function parseCustomerId(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

type CartItem = { productId?: number; productName: string; category?: string };

function parseCartItemsFromQuery(value: string | null): CartItem[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = resolveTenantId(user);

    const { searchParams } = new URL(req.url);
    const customerId = parseCustomerId(searchParams.get("customerId"));
    const cartItems = parseCartItemsFromQuery(searchParams.get("cartItems"));

    const recommendations = await getProductRecommendations(
      cartItems,
      customerId,
      tenantId
    );

    return NextResponse.json({
      success: true,
      recommendations,
      count: recommendations.length,
    });
  } catch (error: any) {
    console.error("Product recommendations error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to get recommendations" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = resolveTenantId(user);

    const body = await req.json();
    const cartItems: CartItem[] = Array.isArray(body?.cartItems) ? body.cartItems : [];
    const customerId: number | undefined =
      body?.customerId == null ? undefined : Number(body.customerId);

    const safeCustomerId = Number.isFinite(customerId as number)
      ? (customerId as number)
      : undefined;

    const recommendations = await getProductRecommendations(
      cartItems,
      safeCustomerId,
      tenantId
    );

    // Optionally save recommendation tracking (non-blocking)
    if (cartItems.length > 0) {
      void Promise.allSettled(
        recommendations.map((rec: any) =>
          prisma.aIProductRecommendation.create({
            data: {
              tenantId,
              sourceProductId: cartItems[0]?.productId ?? null,
              recommendedProductId: rec.productId,
              customerId: safeCustomerId ?? null,
              recommendationType: rec.recommendationType,
              score: rec.score,
              reason: rec.reason ?? null,
              season: rec.season ?? null,
            },
          })
        )
      );
    }

    return NextResponse.json({
      success: true,
      recommendations,
      count: recommendations.length,
    });
  } catch (error: any) {
    console.error("Product recommendations error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to get recommendations" },
      { status: 500 }
    );
  }
}
