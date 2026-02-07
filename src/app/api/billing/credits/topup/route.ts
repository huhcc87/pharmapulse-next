/**
 * Top-up AI Credits
 * 
 * POST /api/billing/credits/topup
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createOrder } from "@/lib/billing/payment-provider";
import crypto from "crypto";
import { z } from "zod";

const TOPUP_CREDITS = 50000;
const TOPUP_PRICE_PAISE = 250000; // ₹2,500

const topupSchema = z.object({
  idempotencyKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await request.json();
    const { idempotencyKey } = topupSchema.parse(body);

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
        message: 'Top-up already processed',
        paymentId: existing.id,
      });
    }

    // Get subscription
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Create payment record
    const payment = await prisma.billingPayment.create({
      data: {
        orgId: user.tenantId,
        tenantId: user.tenantId,
        paymentType: 'CREDIT_TOPUP',
        amountPaise: TOPUP_PRICE_PAISE,
        currency: 'INR',
        paymentProvider: 'stripe',
        status: 'pending',
        idempotencyKey: keyHash,
        metadata: {
          credits: TOPUP_CREDITS,
          userId: user.userId,
        },
      },
    });

    // Create payment order
    const order = await createOrder('stripe', {
      amountPaise: TOPUP_PRICE_PAISE,
      currency: 'inr',
      customerId: subscription.stripeCustomerId || undefined,
      metadata: {
        tenantId: user.tenantId,
        paymentId: payment.id,
        type: 'credit_topup',
        credits: TOPUP_CREDITS.toString(),
      },
      description: `AI Credits Top-up - ${TOPUP_CREDITS.toLocaleString()} credits`,
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
        action: 'CREDIT_TOPUP_INITIATED',
        paymentId: payment.id,
        metadata: {
          credits: TOPUP_CREDITS,
          amountPaise: TOPUP_PRICE_PAISE,
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
      credits: TOPUP_CREDITS,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Credit top-up error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate credit top-up' },
      { status: 500 }
    );
  }
}
