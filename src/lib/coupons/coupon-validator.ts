// Coupon Validation and Application
// Validates coupon codes and calculates discounts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface CouponValidationResult {
  isValid: boolean;
  discountPaise?: number;
  discountPercent?: number;
  error?: string;
  errorCode?: string;
  coupon?: {
    id: number;
    code: string;
    discountType: string;
    discountValue: number;
    description?: string;
  };
}

export interface CouponValidationInput {
  code: string;
  customerId?: number;
  totalAmountPaise: number; // Total cart amount
  tenantId?: number;
}

/**
 * Validate coupon code
 */
export async function validateCoupon(
  input: CouponValidationInput
): Promise<CouponValidationResult> {
  try {
    const tenantId = input.tenantId || 1;

    // Find coupon
    const coupon = await prisma.coupon.findUnique({
      where: {
        code: input.code.toUpperCase(),
      },
    });

    if (!coupon) {
      return {
        isValid: false,
        error: "Invalid coupon code",
        errorCode: "COUPON_NOT_FOUND",
      };
    }

    if (coupon.tenantId !== tenantId) {
      return {
        isValid: false,
        error: "Coupon not valid for this pharmacy",
        errorCode: "TENANT_MISMATCH",
      };
    }

    // Check if active
    if (!coupon.isActive) {
      return {
        isValid: false,
        error: "Coupon is not active",
        errorCode: "COUPON_INACTIVE",
      };
    }

    // Check validity period
    const now = new Date();
    if (now < coupon.validFrom) {
      return {
        isValid: false,
        error: `Coupon is not yet valid. Valid from ${coupon.validFrom.toLocaleDateString()}`,
        errorCode: "COUPON_NOT_YET_VALID",
      };
    }

    if (now > coupon.validUntil) {
      return {
        isValid: false,
        error: `Coupon has expired. Expired on ${coupon.validUntil.toLocaleDateString()}`,
        errorCode: "COUPON_EXPIRED",
      };
    }

    // Check minimum purchase
    if (coupon.minPurchasePaise && input.totalAmountPaise < coupon.minPurchasePaise) {
      const minAmount = (coupon.minPurchasePaise / 100).toFixed(2);
      return {
        isValid: false,
        error: `Minimum purchase amount of ₹${minAmount} required`,
        errorCode: "MIN_PURCHASE_NOT_MET",
      };
    }

    // Check total usage limit
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return {
        isValid: false,
        error: "Coupon usage limit reached",
        errorCode: "COUPON_USAGE_LIMIT_REACHED",
      };
    }

    // Check customer-specific coupon
    if (coupon.customerId) {
      if (!input.customerId || coupon.customerId !== input.customerId) {
        return {
          isValid: false,
          error: "This coupon is not valid for you",
          errorCode: "CUSTOMER_MISMATCH",
        };
      }
    }

    // Check per-customer usage limit
    if (input.customerId && coupon.maxUsesPerCustomer) {
      const customerUsageCount = await prisma.couponUsage.count({
        where: {
          couponId: coupon.id,
          customerId: input.customerId,
        },
      });

      if (customerUsageCount >= coupon.maxUsesPerCustomer) {
        return {
          isValid: false,
          error: "You have already used this coupon",
          errorCode: "CUSTOMER_USAGE_LIMIT_REACHED",
        };
      }
    }

    // Calculate discount
    let discountPaise = 0;

    if (coupon.discountType === "PERCENTAGE") {
      // Percentage discount
      const discountPercent = coupon.discountValue; // 0-100
      discountPaise = Math.round((input.totalAmountPaise * discountPercent) / 100);

      // Apply max discount limit if set
      if (coupon.maxDiscountPaise && discountPaise > coupon.maxDiscountPaise) {
        discountPaise = coupon.maxDiscountPaise;
      }
    } else if (coupon.discountType === "FIXED") {
      // Fixed amount discount
      discountPaise = coupon.discountValue; // Amount in paise

      // Don't exceed total amount
      if (discountPaise > input.totalAmountPaise) {
        discountPaise = input.totalAmountPaise;
      }
    } else {
      return {
        isValid: false,
        error: "Invalid discount type",
        errorCode: "INVALID_DISCOUNT_TYPE",
      };
    }

    return {
      isValid: true,
      discountPaise,
      discountPercent: coupon.discountType === "PERCENTAGE" ? coupon.discountValue : undefined,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        description: coupon.description || undefined,
      },
    };
  } catch (error: any) {
    console.error("Coupon validation error:", error);
    return {
      isValid: false,
      error: error.message || "Coupon validation failed",
      errorCode: "VALIDATION_ERROR",
    };
  }
}

/**
 * Record coupon usage
 */
export async function recordCouponUsage(data: {
  couponId: number;
  invoiceId: number;
  customerId?: number;
  discountPaise: number;
}): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      // Record usage
      await tx.couponUsage.create({
        data: {
          couponId: data.couponId,
          invoiceId: data.invoiceId,
          customerId: data.customerId,
          discountPaise: data.discountPaise,
        },
      });

      // Increment usage count
      await tx.coupon.update({
        where: { id: data.couponId },
        data: {
          usedCount: {
            increment: 1,
          },
        },
      });
    });
  } catch (error) {
    console.error("Failed to record coupon usage:", error);
    // Don't throw - usage tracking is non-critical
  }
}

/**
 * Generate unique coupon code
 */
export function generateCouponCode(prefix: string = "PULSE"): string {
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timestamp = Date.now().toString(36).substring(5, 9).toUpperCase();
  return `${prefix}${timestamp}${randomStr}`;
}
