/**
 * Verify Razorpay Payment
 * 
 * POST /api/billing/verify
 * 
 * Verifies Razorpay payment signature and activates subscription.
 * Requires authenticated user (Supabase session)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { addCredits } from "@/lib/billing/credits";

const MONTHLY_ALLOWANCE = 10000; // 10,000 credits per month
const YEARLY_CREDITS = 120000; // 120,000 credits for the year

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getSessionUser();
    requireAuth(user);
    
    const tenantId = user.tenantId || "default";
    
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing required payment parameters." },
        { status: 400 }
      );
    }
    
    // Get subscription record
    const subscription = await prisma.subscription.findUnique({
      where: {
        tenantId: tenantId,
      },
    });
    
    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription record not found." },
        { status: 404 }
      );
    }
    
    if (subscription.razorpayOrderId !== razorpay_order_id) {
      return NextResponse.json(
        { error: "Order ID mismatch." },
        { status: 400 }
      );
    }
    
    // Check if already verified (idempotency)
    if (subscription.status === "active" && subscription.razorpayPaymentId === razorpay_payment_id) {
      return NextResponse.json({
        success: true,
        message: "Payment already verified.",
        subscription: subscription,
      });
    }
    
    // Verify signature
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json(
        { error: "Payment verification not configured." },
        { status: 500 }
      );
    }
    
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    
    if (expectedSignature !== razorpay_signature) {
      // Log verification failure
      // Note: AuditLog uses Int tenantId, but billing uses String tenantId
      // Skipping audit log for now to avoid type mismatch
      try {
        // await prisma.auditLog.create({ ... });
      } catch (error) {
        console.debug("Audit log creation skipped:", error);
      }
      
      return NextResponse.json(
        { error: "Payment verification failed. Invalid signature." },
        { status: 400 }
      );
    }
    
    // Payment verified - activate subscription
    const now = new Date();
    const oneYearLater = new Date(now);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    
    const updatedSub = await prisma.subscription.update({
      where: {
        id: subscription.id,
      },
      data: {
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: oneYearLater,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        lastPaymentAt: now,
        oneTimePurchasedAt: now,
        oneTimeAmountPaise: 15000 * 100, // ₹15,000
        serviceRenewalStatus: "ACTIVE",
        serviceRenewalNextDue: oneYearLater,
        monthlyCreditGrant: MONTHLY_ALLOWANCE,
        updatedAt: now,
      },
    });
    
    // Log payment verification
    // Note: AuditLog uses Int tenantId, but billing uses String tenantId
    // Skipping audit log for now to avoid type mismatch
    try {
      // await prisma.auditLog.create({ ... });
    } catch (error) {
      console.debug("Audit log creation skipped:", error);
    }
    
    // Grant credits
    try {
      const orgId = tenantId; // Use tenantId as orgId
      await addCredits(orgId, tenantId, "TOPUP", YEARLY_CREDITS, razorpay_payment_id, "subscription_payment");
    } catch (creditError) {
      console.error("Error adding credits (non-fatal):", creditError);
      // Continue even if credit allocation fails
    }
    
    return NextResponse.json({
      success: true,
      message: "Payment verified and subscription activated.",
      subscription: updatedSub,
    });
    
  } catch (error: any) {
    console.error("Verify payment error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify payment. Please try again." },
      { status: 500 }
    );
  }
}
