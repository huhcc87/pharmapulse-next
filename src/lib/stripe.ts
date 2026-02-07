import Stripe from "stripe";

// Lazy initialization - only create Stripe instance when needed and API key is available
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured. Please set it in your environment variables (.env.local).');
    }
    stripeInstance = new Stripe(apiKey, {
      apiVersion: "2025-01-27.acacia", // ok if Stripe updates; if error, set to your installed version's supported api
    });
  }
  return stripeInstance;
}

// Export function to check if Stripe is configured
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
