// Referral Program Management
// GET /api/referrals - List referral codes
// POST /api/referrals - Create referral code
// POST /api/referrals/use - Use referral code

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

// GET /api/referrals - List referral codes
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.nextUrl.searchParams;
    const referrerId = searchParams.get("referrerId");

    const where: any = {
      tenantId: DEMO_TENANT_ID,
    };

    if (referrerId) {
      where.referrerId = parseInt(referrerId);
    }

    const referralCodes = await prisma.referralCode.findMany({
      where,
      include: {
        referrer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        _count: {
          select: {
            referrals: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      referralCodes: referralCodes.map((code) => ({
        id: code.id,
        code: code.code,
        referrer: code.referrer,
        referrerRewardType: code.referrerRewardType,
        referrerRewardValue: code.referrerRewardValue,
        referredRewardType: code.referredRewardType,
        referredRewardValue: code.referredRewardValue,
        maxUses: code.maxUses,
        usedCount: (code as any)._count?.referrals || 0, // Use _count if available, otherwise 0
        validFrom: code.validFrom,
        validUntil: code.validUntil,
        isActive: code.isActive,
      })),
    });
  } catch (error: any) {
    console.error("List referral codes API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/referrals - Create referral code
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const {
      referrerId,
      code,
      referrerRewardType,
      referrerRewardValue,
      referredRewardType,
      referredRewardValue,
      maxUses,
      validFrom,
      validUntil,
    } = body;

    if (!referrerId || !referrerRewardType || !referrerRewardValue) {
      return NextResponse.json(
        { error: "referrerId, referrerRewardType, and referrerRewardValue are required" },
        { status: 400 }
      );
    }

    // Generate code if not provided
    const referralCode = code || generateReferralCode();

    // Check if code exists
    const existing = await prisma.referralCode.findUnique({
      where: { code: referralCode.toUpperCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Referral code already exists" },
        { status: 400 }
      );
    }

    // Create referral code
    const newCode = await prisma.referralCode.create({
      data: {
        tenantId: DEMO_TENANT_ID,
        referrerId: parseInt(referrerId),
        code: referralCode.toUpperCase(),
        referrerRewardType,
        referrerRewardValue,
        referredRewardType: referredRewardType || "POINTS",
        referredRewardValue: referredRewardValue || 100,
        maxUses: maxUses || null,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validUntil: validUntil ? new Date(validUntil) : null,
        isActive: true,
      },
      include: {
        referrer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      referralCode: {
        id: newCode.id,
        code: newCode.code,
        referrer: newCode.referrer,
        referrerRewardType: newCode.referrerRewardType,
        referrerRewardValue: newCode.referrerRewardValue,
        referredRewardType: newCode.referredRewardType,
        referredRewardValue: newCode.referredRewardValue,
      },
    });
  } catch (error: any) {
    console.error("Create referral code API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing chars
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
