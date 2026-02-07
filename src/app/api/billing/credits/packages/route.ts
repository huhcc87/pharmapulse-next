// Credit Packages API
// GET /api/billing/credits/packages - List packages
// POST /api/billing/credits/packages - Purchase package

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { getCreditPackages, purchaseCreditPackage } from "@/lib/billing/credit-management";

export async function GET(req: NextRequest) {
  try {
    const packages = await getCreditPackages();

    return NextResponse.json({
      packages: packages.map((p) => ({
        name: p.name,
        credits: p.credits,
        pricePaise: p.pricePaise,
        validityDays: p.validityDays,
        bonusCredits: p.bonusCredits,
        pricePerCredit: p.pricePaise / p.credits,
      })),
    });
  } catch (error: any) {
    console.error("Get credit packages API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { packageName } = body;

    if (!packageName) {
      return NextResponse.json(
        { error: "packageName is required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";

    const result = await purchaseCreditPackage(tenantId, packageName);

    return NextResponse.json({
      success: true,
      creditsAdded: result.creditsAdded,
      expiresAt: result.expiresAt,
    });
  } catch (error: any) {
    console.error("Purchase credit package API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
