/**
 * Create Razorpay Order
 * 
 * POST /api/billing/create-order
 * 
 * Creates a Razorpay order for yearly subscription (₹15,000/year)
 * Requires authenticated user (Supabase session)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Razorpay from "razorpay";
import crypto from "crypto";

const PLAN_PRICE_PAISE = 15000 * 100; // ₹15,000 in paise
const PLAN_CODE = "yearly";

// Initialize Razorpay
function getRazorpayInstance() {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  
  if (!keyId || !keySecret) {
    throw new Error("Razorpay keys not configured. Please set NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET");
  }
  
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user using current auth system
    const user = await getSessionUser();
    requireAuth(user);
    
    const tenantId = user.tenantId || "default";
    
    // Check if user already has an active subscription
    const existingSub = await prisma.subscription.findUnique({
      where: {
        tenantId: tenantId,
      },
    });
    
    if (existingSub && existingSub.status === "active") {
      return NextResponse.json(
        { error: "You already have an active subscription." },
        { status: 400 }
      );
    }
    
    // Try to get Razorpay instance
    let razorpay;
    try {
      razorpay = getRazorpayInstance();
    } catch (razorpayError: any) {
      // If Razorpay not configured, check if Stripe is available
      const { isStripeConfigured, getStripe } = await import("@/lib/stripe");
      
      if (isStripeConfigured()) {
        // Fallback to Stripe
        const stripe = getStripe();
        
        // Get or create Stripe customer
        let customerId: string | undefined;
        const existingSub = await prisma.subscription.findUnique({
          where: { tenantId },
          select: { stripeCustomerId: true },
        });
        
        if (existingSub?.stripeCustomerId) {
          customerId = existingSub.stripeCustomerId;
        } else {
          const customer = await stripe.customers.create({
            email: user.email || undefined,
            metadata: {
              tenantId,
              userId: user.userId || "",
            },
          });
          customerId = customer.id;
          
          // Update subscription with customer ID
          await prisma.subscription.upsert({
            where: { tenantId },
            update: { stripeCustomerId: customerId },
            create: {
              tenantId,
              plan: PLAN_CODE,
              status: "expired",
              stripeCustomerId: customerId,
              oneTimeAmountPaise: PLAN_PRICE_PAISE,
              branchesIncluded: 1,
              prioritySupport: false,
              monthlyCreditGrant: 10000,
            },
          });
        }
        
        // Create Stripe Checkout Session for better UX
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'inr',
                product_data: {
                  name: 'PharmaPulse Yearly Plan',
                  description: 'Yearly subscription - ₹15,000/year',
                },
                unit_amount: PLAN_PRICE_PAISE,
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/settings?tab=billing&payment=success`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/settings?tab=billing&payment=cancelled`,
          metadata: {
            userId: user.userId || "",
            tenantId: tenantId,
            planCode: PLAN_CODE,
            userEmail: user.email || "",
          },
        });
        
        return NextResponse.json({
          orderId: session.id,
          amount: PLAN_PRICE_PAISE,
          currency: "INR",
          checkoutUrl: session.url,
          provider: "stripe",
          planCode: PLAN_CODE,
        });
      }
      
      // Neither provider configured
      throw new Error("Payment provider not configured. Please set RAZORPAY_KEY_SECRET or STRIPE_SECRET_KEY");
    }
    
    // Create Razorpay order
    const receipt = `pharmapulse_${tenantId}_${Date.now()}`;
    
    const order = await razorpay.orders.create({
      amount: PLAN_PRICE_PAISE,
      currency: "INR",
      receipt: receipt,
      notes: {
        userId: user.userId || "",
        tenantId: tenantId,
        planCode: PLAN_CODE,
        userEmail: user.email || "",
      },
    });
    
    // Create or update subscription record (inactive/pending)
    await prisma.subscription.upsert({
      where: {
        tenantId: tenantId,
      },
      update: {
        plan: PLAN_CODE,
        status: "expired", // Will be updated to "active" after payment verification
        razorpayOrderId: order.id,
        updatedAt: new Date(),
      },
      create: {
        tenantId: tenantId,
        plan: PLAN_CODE,
        status: "expired", // Will be updated to "active" after payment verification
        razorpayOrderId: order.id,
        oneTimeAmountPaise: PLAN_PRICE_PAISE,
        branchesIncluded: 1,
        prioritySupport: false,
        monthlyCreditGrant: 10000,
      },
    });
    
    // Log payment event (audit log)
    // Note: AuditLog uses Int tenantId, but billing uses String tenantId
    // Skipping audit log for now to avoid type mismatch
    // TODO: Update AuditLog schema to support String tenantId or add mapping
    try {
      // Only log if we can safely convert (for now, skip)
      // await prisma.auditLog.create({ ... });
    } catch (error) {
      // Silently fail - audit log is not critical
      console.debug("Audit log creation skipped:", error);
    }
    
    return NextResponse.json({
      orderId: order.id,
      amount: PLAN_PRICE_PAISE,
      currency: "INR",
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      provider: "razorpay",
      planCode: PLAN_CODE,
      receipt,
    });
    
  } catch (error: any) {
    console.error("Create order error:", error);
    
    if (error.message?.includes("not configured") || error.message?.includes("Payment provider")) {
      return NextResponse.json(
        { 
          error: "Payment provider not configured", 
          message: "Please configure Razorpay (RAZORPAY_KEY_SECRET) or Stripe (STRIPE_SECRET_KEY) in environment variables." 
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to create order. Please try again." },
      { status: 500 }
    );
  }
}
