/**
 * Subscribe to Annual Service Renewal
 * 
 * POST /api/billing/renewal/subscribe
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createOrder } from "@/lib/billing/payment-provider";
import crypto from "crypto";
import { z } from "zod";

const RENEWAL_PRICE_PAISE = 100000; // ₹1,000/year

const subscribeSchema = z.object({
  idempotencyKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await request.json();
    const { idempotencyKey } = subscribeSchema.parse(body);

    // Check if plan is purchased
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!subscription || subscription.planType !== 'one_time' || !subscription.oneTimePurchasedAt) {
      return NextResponse.json(
        { error: 'PharmaPulse One plan must be purchased first' },
        { status: 400 }
      );
    }

    // Generate idempotency key
    const key = idempotencyKey || crypto.randomBytes(16).toString('hex');
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');

    // Check idempotency
    const existing = await prisma.billingPayment.findUnique({
      where: { idempotencyKey: keyHash },
    });

    if (existing && existing.status === 'succeeded') {
      return NextResponse.json({
        success: true,
        message: 'Renewal already subscribed',
        paymentId: existing.id,
      });
    }

    // Create payment record
    const payment = await prisma.billingPayment.create({
      data: {
        orgId: user.tenantId,
        tenantId: user.tenantId,
        paymentType: 'RENEWAL',
        amountPaise: RENEWAL_PRICE_PAISE,
        currency: 'INR',
        paymentProvider: 'stripe',
        status: 'pending',
        idempotencyKey: keyHash,
        metadata: {
          userId: user.userId,
        },
      },
    });

    // Create payment order
    const order = await createOrder('stripe', {
      amountPaise: RENEWAL_PRICE_PAISE,
      currency: 'inr',
      customerId: subscription.stripeCustomerId || undefined,
      metadata: {
        tenantId: user.tenantId,
        paymentId: payment.id,
        type: 'renewal',
      },
      description: `PharmaPulse One - Annual Service Renewal`,
    });

    // Update payment
    await prisma.billingPayment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: order.orderId,
        providerCustomerId: order.customerId,
      },
    });

    // Log audit
    await prisma.billingAuditLog.create({
      data: {
        orgId: user.tenantId,
        tenantId: user.tenantId,
        actorUserId: user.userId,
        action: 'RENEWAL_SUBSCRIBE_INITIATED',
        paymentId: payment.id,
        metadata: {
          amountPaise: RENEWAL_PRICE_PAISE,
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
    console.error('Renewal subscribe error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate renewal subscription' },
      { status: 500 }
    );
  }
}
