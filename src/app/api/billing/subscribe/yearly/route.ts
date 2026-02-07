/**
 * Subscribe to Yearly Plan
 * 
 * POST /api/billing/subscribe/yearly
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createOrder } from "@/lib/billing/payment-provider";
import crypto from "crypto";

const PLAN_PRICE_PAISE = 1500000; // ₹15,000
const PLAN_NAME = "Yearly Plan";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Get or create subscription
    let subscription = await prisma.subscription.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!subscription) {
      subscription = await prisma.subscription.create({
        data: {
          tenantId: user.tenantId,
          plan: 'yearly',
          status: 'expired',
        },
      });
    }

    // Check if already has active subscription
    if (subscription.planType === 'one_time' && subscription.oneTimePurchasedAt) {
      return NextResponse.json(
        { error: 'You already have an active subscription' },
        { status: 400 }
      );
    }

    // Generate idempotency key
    const idempotencyKey = crypto.randomBytes(16).toString('hex');
    const keyHash = crypto.createHash('sha256').update(idempotencyKey).digest('hex');

    // Create payment record (with error handling)
    // Note: BillingPayment requires a relation to Subscription via tenantId
    let payment;
    try {
      payment = await prisma.billingPayment.create({
        data: {
          tenantId: user.tenantId, // This creates the relation to Subscription
          orgId: user.tenantId, // Use tenantId as orgId for now (may need to be different)
          paymentType: 'PLAN_PURCHASE',
          amountPaise: PLAN_PRICE_PAISE,
          currency: 'INR',
          paymentProvider: 'stripe',
          status: 'pending',
          idempotencyKey: keyHash,
          metadata: {
            planName: PLAN_NAME,
            userId: user.userId,
          },
        },
      });
    } catch (paymentError: any) {
      console.error('Failed to create payment record:', paymentError);
      // If payment creation fails, still try to proceed or return error
      if (paymentError.code === 'P2002') {
        // Duplicate idempotency key - find existing payment
        payment = await prisma.billingPayment.findUnique({
          where: { idempotencyKey: keyHash },
        });
        if (!payment) {
          throw new Error('Failed to create or find payment record');
        }
      } else {
        throw paymentError;
      }
    }

    // Create payment order (with error handling)
    let order;
    try {
      order = await createOrder('stripe', {
        amountPaise: PLAN_PRICE_PAISE,
        currency: 'inr',
        customerId: subscription.stripeCustomerId || undefined,
        metadata: {
          tenantId: user.tenantId,
          paymentId: payment.id,
          planName: PLAN_NAME,
        },
        description: `PharmaPulse Yearly Plan - ${PLAN_NAME}`,
      });
    } catch (orderError: any) {
      console.error('Failed to create payment order:', orderError);
      // Return payment ID but indicate setup is needed
      return NextResponse.json({
        success: false,
        error: 'Payment provider not configured',
        message: 'Stripe is not set up. Please configure payment provider settings.',
        paymentId: payment.id,
      }, { status: 503 });
    }

    // Update payment with provider info
    await prisma.billingPayment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: order.orderId,
        providerCustomerId: order.customerId,
      },
    });

    // Update subscription with customer ID
    if (order.customerId && !subscription.stripeCustomerId) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { stripeCustomerId: order.customerId },
      });
    }

    // Log audit (with error handling - don't fail if audit log fails)
    try {
      await prisma.billingAuditLog.create({
        data: {
          orgId: user.tenantId,
          tenantId: user.tenantId,
          actorUserId: user.userId,
          action: 'PLAN_PURCHASE_INITIATED',
          paymentId: payment.id,
          metadata: {
            planName: PLAN_NAME,
            amountPaise: PLAN_PRICE_PAISE,
          },
          ipAddress: request.headers.get('x-forwarded-for') || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log (non-fatal):', auditError);
      // Continue even if audit log fails
    }

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      clientSecret: order.clientSecret,
      checkoutUrl: order.checkoutUrl,
      url: order.checkoutUrl, // For compatibility
    });
  } catch (error: any) {
    console.error('Yearly subscription error:', error);
    
    // Always return JSON, never HTML
    const errorMessage = error?.message || 'Failed to initiate subscription';
    
    // Handle specific error types
    if (errorMessage.includes('UNAUTHORIZED') || error?.status === 401) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Please log in to subscribe' },
        { status: 401 }
      );
    }
    
    // Handle Prisma errors
    if (error?.code) {
      return NextResponse.json(
        { error: 'Database error', message: errorMessage, code: error.code },
        { status: 500 }
      );
    }
    
    // Generic error response
    return NextResponse.json(
      { error: errorMessage },
      { status: error?.status || 500 }
    );
  }
}
