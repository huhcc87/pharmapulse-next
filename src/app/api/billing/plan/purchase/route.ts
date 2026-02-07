/**
 * Purchase PharmaPulse One Plan (One-time)
 * 
 * POST /api/billing/plan/purchase
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createOrder, handlePaymentSuccess } from "@/lib/billing/payment-provider";
import { addCredits } from "@/lib/billing/credits";
import crypto from "crypto";
import { z } from "zod";

const PLAN_PRICE_PAISE = 1500000; // ₹15,000
const PLAN_NAME = "PharmaPulse One";

const purchaseSchema = z.object({
  idempotencyKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await request.json();
    const { idempotencyKey } = purchaseSchema.parse(body);

    // Generate idempotency key if not provided
    const key = idempotencyKey || crypto.randomBytes(16).toString('hex');
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');

    // Check idempotency
    const existing = await prisma.billingPayment.findUnique({
      where: { idempotencyKey: keyHash },
    });

    if (existing) {
      if (existing.status === 'succeeded') {
        return NextResponse.json({
          success: true,
          message: 'Plan already purchased',
          paymentId: existing.id,
        });
      }
      // If pending or failed, allow retry
    }

    // Get or create subscription
    let subscription = await prisma.subscription.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!subscription) {
      subscription = await prisma.subscription.create({
        data: {
          tenantId: user.tenantId,
          plan: 'one',
          status: 'expired',
        },
      });
    }

    // Check if already purchased
    if (subscription.planType === 'one_time' && subscription.oneTimePurchasedAt) {
      return NextResponse.json(
        { error: 'Plan already purchased' },
        { status: 400 }
      );
    }

    // Create payment record
    const payment = await prisma.billingPayment.create({
      data: {
        orgId: user.tenantId, // Assuming tenantId = orgId
        tenantId: user.tenantId,
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

    // Create payment order
    const order = await createOrder('stripe', {
      amountPaise: PLAN_PRICE_PAISE,
      currency: 'inr',
      customerId: subscription.stripeCustomerId || undefined,
      metadata: {
        tenantId: user.tenantId,
        paymentId: payment.id,
        planName: PLAN_NAME,
      },
      description: `PharmaPulse One - One-time purchase`,
    });

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

    // Log audit
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

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      clientSecret: order.clientSecret,
      checkoutUrl: order.checkoutUrl,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Plan purchase error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate plan purchase' },
      { status: 500 }
    );
  }
}
