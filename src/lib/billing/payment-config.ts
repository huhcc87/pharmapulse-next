// Payment Provider Configuration Helper
// Checks which payment providers are configured and provides fallbacks

import { isStripeConfigured } from "@/lib/stripe";

export type PaymentProvider = "razorpay" | "stripe" | "none";

export interface PaymentConfig {
  provider: PaymentProvider;
  isConfigured: boolean;
  message?: string;
}

/**
 * Check if Razorpay is configured
 */
export function isRazorpayConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && 
    process.env.RAZORPAY_KEY_SECRET
  );
}

/**
 * Get available payment provider
 */
export function getAvailablePaymentProvider(): PaymentConfig {
  if (isRazorpayConfigured()) {
    return {
      provider: "razorpay",
      isConfigured: true,
    };
  }
  
  if (isStripeConfigured()) {
    return {
      provider: "stripe",
      isConfigured: true,
    };
  }
  
  return {
    provider: "none",
    isConfigured: false,
    message: "No payment provider configured. Please set RAZORPAY_KEY_SECRET or STRIPE_SECRET_KEY",
  };
}

/**
 * Get payment provider status for UI
 */
export function getPaymentProviderStatus(): {
  razorpay: boolean;
  stripe: boolean;
  available: boolean;
  message?: string;
} {
  const razorpay = isRazorpayConfigured();
  const stripe = isStripeConfigured();
  const available = razorpay || stripe;
  
  let message: string | undefined;
  if (!available) {
    message = "Please configure Razorpay (RAZORPAY_KEY_SECRET) or Stripe (STRIPE_SECRET_KEY) in environment variables.";
  }
  
  return {
    razorpay,
    stripe,
    available,
    message,
  };
}
