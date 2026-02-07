// Coupon Management API
// GET /api/coupons - List coupons
// POST /api/coupons - Create coupon
// PATCH /api/coupons/[id] - Update coupon
// DELETE /api/coupons/[id] - Delete coupon

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCouponCode, validateCoupon } from "@/lib/coupons/coupon-validator";

const DEMO_TENANT_ID = 1;

// GET /api/coupons - List coupons
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.nextUrl.searchParams;
    const isActive = searchParams.get("isActive");
    const customerId = searchParams.get("customerId");

    const where: any = {
      tenantId: DEMO_TENANT_ID,
    };

    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    if (customerId) {
      where.customerId = parseInt(customerId);
    }

    const coupons = await prisma.coupon.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        _count: {
          select: {
            usages: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      coupons: coupons.map((coupon) => ({
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minPurchasePaise: coupon.minPurchasePaise,
        maxDiscountPaise: coupon.maxDiscountPaise,
        validFrom: coupon.validFrom,
        validUntil: coupon.validUntil,
        maxUses: coupon.maxUses,
        maxUsesPerCustomer: coupon.maxUsesPerCustomer,
        usedCount: coupon._count?.usages || 0,
        isActive: coupon.isActive,
        description: coupon.description,
        terms: coupon.terms,
        customer: coupon.customer,
      })),
    });
  } catch (error: any) {
    console.error("List coupons API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/coupons - Create coupon
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const {
      code,
      discountType,
      discountValue,
      minPurchasePaise,
      maxDiscountPaise,
      validFrom,
      validUntil,
      maxUses,
      maxUsesPerCustomer,
      customerId,
      description,
      terms,
    } = body;

    // Validate required fields
    if (!discountType || !["PERCENTAGE", "FIXED"].includes(discountType)) {
      return NextResponse.json(
        { error: "discountType must be PERCENTAGE or FIXED" },
        { status: 400 }
      );
    }

    if (!discountValue || discountValue <= 0) {
      return NextResponse.json(
        { error: "discountValue must be greater than 0" },
        { status: 400 }
      );
    }

    if (discountType === "PERCENTAGE" && discountValue > 100) {
      return NextResponse.json(
        { error: "Percentage discount cannot exceed 100%" },
        { status: 400 }
      );
    }

    if (!validFrom || !validUntil) {
      return NextResponse.json(
        { error: "validFrom and validUntil are required" },
        { status: 400 }
      );
    }

    if (new Date(validUntil) < new Date(validFrom)) {
      return NextResponse.json(
        { error: "validUntil must be after validFrom" },
        { status: 400 }
      );
    }

    // Generate code if not provided
    const couponCode = code || generateCouponCode();

    // Check if code already exists
    const existingCoupon = await prisma.coupon.findUnique({
      where: { code: couponCode.toUpperCase() },
    });

    if (existingCoupon) {
      return NextResponse.json(
        { error: "Coupon code already exists" },
        { status: 400 }
      );
    }

    // Create coupon
    const coupon = await prisma.coupon.create({
      data: {
        code: couponCode.toUpperCase(),
        tenantId: DEMO_TENANT_ID,
        discountType,
        discountValue,
        minPurchasePaise: minPurchasePaise || null,
        maxDiscountPaise: maxDiscountPaise || null,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
        maxUses: maxUses || null,
        maxUsesPerCustomer: maxUsesPerCustomer || 1,
        customerId: customerId ? parseInt(customerId) : null,
        description: description || null,
        terms: terms || null,
        isActive: true,
      },
      include: {
        customer: {
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
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        validFrom: coupon.validFrom,
        validUntil: coupon.validUntil,
        isActive: coupon.isActive,
        customer: coupon.customer,
      },
    });
  } catch (error: any) {
    console.error("Create coupon API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
