// Coupon Validation API
// POST /api/coupons/validate
// Validate coupon code and calculate discount

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { validateCoupon } from "@/lib/coupons/coupon-validator";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { code, customerId, totalAmountPaise } = body;

    if (!code) {
      return NextResponse.json(
        { error: "code is required" },
        { status: 400 }
      );
    }

    if (!totalAmountPaise || totalAmountPaise <= 0) {
      return NextResponse.json(
        { error: "totalAmountPaise must be greater than 0" },
        { status: 400 }
      );
    }

    // Validate coupon
    const result = await validateCoupon({
      code,
      customerId: customerId ? parseInt(customerId) : undefined,
      totalAmountPaise,
    });

    if (!result.isValid) {
      return NextResponse.json(
        {
          isValid: false,
          error: result.error || "Coupon validation failed",
          errorCode: result.errorCode,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      isValid: true,
      discountPaise: result.discountPaise,
      discountPercent: result.discountPercent,
      coupon: result.coupon,
    });
  } catch (error: any) {
    console.error("Coupon validation API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
