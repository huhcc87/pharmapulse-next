// GET /api/billing/payment-status
// Get payment provider configuration status

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getPaymentProviderStatus } from "@/lib/billing/payment-config";

export async function GET(req: NextRequest) {
  try {
    // No auth required - just check configuration
    const status = getPaymentProviderStatus();
    
    return NextResponse.json({
      ...status,
      instructions: status.available
        ? undefined
        : "To enable payments, add one of the following to your .env.local file:\n\n" +
          "For Razorpay:\n" +
          "NEXT_PUBLIC_RAZORPAY_KEY_ID=your_key_id\n" +
          "RAZORPAY_KEY_SECRET=your_key_secret\n\n" +
          "For Stripe:\n" +
          "STRIPE_SECRET_KEY=your_secret_key\n" +
          "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_publishable_key",
    });
  } catch (error: any) {
    console.error("Get payment status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get payment status" },
      { status: 500 }
    );
  }
}
