// Referral Code API
// GET /api/referrals/code?customerId=123 - Get customer's referral code
// POST /api/referrals/code - Generate referral code

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateReferralCode } from "@/lib/referrals/referral-manager";

const DEMO_TENANT_ID = 1;

function toInt(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function resolveTenantId(user: any): number {
  return toInt(user?.tenantId) ?? DEMO_TENANT_ID;
}

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const url = new URL(req.url);
    const customerId = toInt(url.searchParams.get("customerId"));

    if (customerId === undefined) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    const tenantId = resolveTenantId(user);

    const referralCode = await prisma.referralCode.findFirst({
      where: {
        referrerId: customerId,
        tenantId,
        isActive: true,
      },
      select: {
        code: true,
        createdAt: true,
      },
    });

    if (!referralCode) {
      return NextResponse.json({
        success: false,
        message: "No referral code found. Generate one first.",
      });
    }

    return NextResponse.json({
      success: true,
      referralCode,
    });
  } catch (error: any) {
    console.error("Get referral code API error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const customerId = toInt(body?.customerId);

    if (customerId === undefined) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    const tenantId = resolveTenantId(user);

    const result = await generateReferralCode({
      customerId,
      tenantId,
    });

    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error || "Referral code generation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      referralCode: result.referralCode,
    });
  } catch (error: any) {
    console.error("Generate referral code API error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
