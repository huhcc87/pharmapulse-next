/**
 * Payment Webhook Handler
 * 
 * Handles Stripe webhook events for payment confirmation
 */

import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { handlePaymentSuccess } from "@/lib/billing/payment-provider";
import { addCredits } from "@/lib/billing/credits";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 503 }
      );
    }

    let stripe;
    try {
      stripe = getStripe();
    } catch (stripeError: any) {
      return NextResponse.json(
        { error: 'Payment provider not configured', message: stripeError.message },
        { status: 503 }
      );
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 }
      );
    }

    try {
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as any;
        await handlePaymentSuccessWebhook(paymentIntent);
      } else if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object as any;
        await handlePaymentFailureWebhook(paymentIntent);
      }
    } catch (error: any) {
      console.error('Webhook handler error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to process webhook' },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook route error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process webhook' },
      { status: error?.status || 500 }
    );
  }
}

async function handlePaymentSuccessWebhook(paymentIntent: any) {
  const paymentId = paymentIntent.metadata?.paymentId;
  if (!paymentId) {
    console.error('Payment ID not found in metadata');
    return;
  }

  const payment = await prisma.billingPayment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    console.error(`Payment not found: ${paymentId}`);
    return;
  }

  if (payment.status === 'succeeded') {
    // Already processed
    return;
  }

  // Get payment details
  const result = await handlePaymentSuccess('stripe', paymentIntent.id);

  // Update payment status
  await prisma.$transaction(async (tx) => {
    await tx.billingPayment.update({
      where: { id: payment.id },
      data: {
        status: 'succeeded',
        paidAt: new Date(),
        amountPaise: result.amountPaise,
      },
    });

    // Handle based on payment type
    if (payment.paymentType === 'PLAN_PURCHASE') {
      // Activate plan
      await tx.subscription.update({
        where: { tenantId: payment.tenantId },
        data: {
          planType: 'one_time',
          plan: 'one',
          status: 'active',
          oneTimePurchasedAt: new Date(),
          oneTimeAmountPaise: result.amountPaise,
          branchesIncluded: 1,
          prioritySupport: true,
          monthlyCreditGrant: 10000,
          featuresJson: {
            all: true,
          },
        },
      });

      // Grant initial monthly credits
      await addCredits(
        payment.orgId,
        payment.tenantId,
        'GRANT_MONTHLY',
        10000,
        payment.id,
        'plan_purchase',
        undefined,
        { source: 'initial_grant' }
      );
    } else if (payment.paymentType === 'RENEWAL') {
      // Activate renewal
      const nextDue = new Date();
      nextDue.setFullYear(nextDue.getFullYear() + 1);

      await tx.subscription.update({
        where: { tenantId: payment.tenantId },
        data: {
          serviceRenewalStatus: 'ACTIVE',
          serviceRenewalNextDue: nextDue,
        },
      });
    } else if (payment.paymentType === 'CREDIT_TOPUP') {
      // Add credits
      const credits = payment.metadata && (payment.metadata as any)?.credits 
        ? parseInt((payment.metadata as any).credits as string, 10)
        : 10000;

      await addCredits(
        payment.orgId,
        payment.tenantId,
        'TOPUP',
        credits,
        payment.id,
        'credit_topup',
        undefined, // Top-ups don't expire
        { source: 'topup_purchase' }
      );
    }

    // Log audit
    await tx.billingAuditLog.create({
      data: {
        orgId: payment.orgId,
        tenantId: payment.tenantId,
        action: `PAYMENT_SUCCESS_${payment.paymentType}`,
        paymentId: payment.id,
        metadata: {
          providerPaymentId: paymentIntent.id,
          amountPaise: result.amountPaise,
        },
      },
    });
  });
}

async function handlePaymentFailureWebhook(paymentIntent: any) {
  const paymentId = paymentIntent.metadata?.paymentId;
  if (!paymentId) return;

  await prisma.billingPayment.update({
    where: { id: paymentId },
    data: {
      status: 'failed',
    },
  });

  await prisma.billingAuditLog.create({
    data: {
      orgId: paymentIntent.metadata?.tenantId || '',
      tenantId: paymentIntent.metadata?.tenantId || '',
      action: 'PAYMENT_FAILED',
      paymentId,
      metadata: {
        providerPaymentId: paymentIntent.id,
        error: paymentIntent.last_payment_error,
      },
    },
  });
}
