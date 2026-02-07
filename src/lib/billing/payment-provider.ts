/**
 * Payment Provider Abstraction Layer
 * 
 * Supports Stripe, Razorpay, etc.
 */

import crypto from "crypto";
// Note: stripe is imported lazily to avoid initialization errors when API key is missing

export type PaymentProvider = 'stripe' | 'razorpay';

export interface CreateOrderParams {
  amountPaise: number;
  currency?: string;
  customerId?: string;
  metadata?: Record<string, string>;
  description?: string;
}

export interface CreateOrderResult {
  orderId: string;
  clientSecret?: string;
  checkoutUrl?: string;
  customerId?: string;
}

export interface VerifyWebhookParams {
  signature: string;
  payload: string | Buffer;
  secret: string;
}

/**
 * Create payment order (Stripe Payment Intent or Razorpay Order)
 */
export async function createOrder(
  provider: PaymentProvider,
  params: CreateOrderParams
): Promise<CreateOrderResult> {
  if (provider === 'stripe') {
    return createStripeOrder(params);
  } else if (provider === 'razorpay') {
    return createRazorpayOrder(params);
  } else {
    throw new Error(`Unsupported payment provider: ${provider}`);
  }
}

/**
 * Create Stripe Payment Intent
 */
async function createStripeOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  // Import stripe lazily to avoid initialization errors
  const { getStripe } = await import('@/lib/stripe');
  
  let stripe;
  try {
    stripe = getStripe();
  } catch (error: any) {
    throw new Error(`Stripe is not configured: ${error.message}`);
  }

  // Create or get customer
  let customerId = params.customerId;
  if (!customerId && params.metadata?.email) {
    const customer = await stripe.customers.create({
      email: params.metadata.email,
      metadata: params.metadata,
    });
    customerId = customer.id;
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: params.amountPaise, // Stripe uses smallest currency unit (paise for INR)
    currency: params.currency || 'inr',
    customer: customerId,
    metadata: params.metadata || {},
    description: params.description,
    automatic_payment_methods: {
      enabled: true,
    },
  });

  return {
    orderId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret || undefined,
    customerId: customerId || undefined,
  };
}

/**
 * Create Razorpay Order
 */
async function createRazorpayOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const Razorpay = (await import("razorpay")).default;
  
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  
  if (!keyId || !keySecret) {
    throw new Error("Razorpay keys not configured. Please set NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET");
  }
  
  const razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
  
  const receipt = `pharmapulse_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  const order = await razorpay.orders.create({
    amount: params.amountPaise,
    currency: params.currency || "INR",
    receipt: receipt,
    notes: params.metadata || {},
  });
  
  return {
    orderId: order.id,
    checkoutUrl: undefined, // Razorpay uses client-side checkout
    customerId: params.customerId,
  };
}

/**
 * Verify webhook signature
 */
export async function verifyWebhookSignature(
  provider: PaymentProvider,
  params: VerifyWebhookParams
): Promise<boolean> {
  if (provider === 'stripe') {
    return verifyStripeWebhook(params);
  } else if (provider === 'razorpay') {
    return verifyRazorpayWebhook(params);
  } else {
    throw new Error(`Unsupported payment provider: ${provider}`);
  }
}

/**
 * Verify Stripe webhook signature
 */
async function verifyStripeWebhook(params: VerifyWebhookParams): Promise<boolean> {
  try {
    const { getStripe } = await import('@/lib/stripe');
    const stripe = getStripe();
    const signature = stripe.webhooks.constructEvent(
      params.payload as string,
      params.signature,
      params.secret
    );
    return !!signature;
  } catch (error) {
    console.error('Stripe webhook verification failed:', error);
    return false;
  }
}

/**
 * Verify Razorpay webhook signature (placeholder)
 */
async function verifyRazorpayWebhook(params: VerifyWebhookParams): Promise<boolean> {
  // TODO: Implement Razorpay webhook verification
  // Razorpay uses HMAC SHA256
  const expectedSignature = crypto
    .createHmac('sha256', params.secret)
    .update(params.payload as string)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(params.signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Handle payment success
 */
export async function handlePaymentSuccess(
  provider: PaymentProvider,
  paymentId: string
): Promise<{
  success: boolean;
  amountPaise: number;
  customerId?: string;
  metadata?: Record<string, string>;
}> {
  if (provider === 'stripe') {
    const { getStripe } = await import('@/lib/stripe');
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
    return {
      success: paymentIntent.status === 'succeeded',
      amountPaise: paymentIntent.amount,
      customerId: typeof paymentIntent.customer === 'string' 
        ? paymentIntent.customer 
        : paymentIntent.customer?.id,
      metadata: paymentIntent.metadata as Record<string, string>,
    };
  } else {
    throw new Error(`Payment success handling not implemented for ${provider}`);
  }
}
