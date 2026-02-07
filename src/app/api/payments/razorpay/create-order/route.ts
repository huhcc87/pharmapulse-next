// POST /api/payments/razorpay/create-order
// Create Razorpay order for POS payment

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import Razorpay from "razorpay";

const DEMO_TENANT_ID = 1;

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

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { amountPaise, invoiceId, description, customerName, customerEmail, customerPhone } = body;

    if (!amountPaise || amountPaise <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    // Convert paise to rupees for Razorpay (amount in smallest currency unit)
    const amount = amountPaise; // Razorpay expects amount in paise (smallest currency unit)

    try {
      const razorpay = getRazorpayInstance();

      // Create Razorpay order
      const order = await razorpay.orders.create({
        amount: amount, // Amount in paise
        currency: "INR",
        receipt: invoiceId ? `INV-${invoiceId}` : `POS-${Date.now()}`,
        notes: {
          invoiceId: invoiceId?.toString() || "",
          tenantId: (user.tenantId || DEMO_TENANT_ID).toString(),
          userId: user.userId?.toString() || "",
        },
      });

      return NextResponse.json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // Return public key for client-side checkout
      });
    } catch (razorpayError: any) {
      console.error("Razorpay order creation error:", razorpayError);
      return NextResponse.json(
        { 
          error: razorpayError.message || "Failed to create payment order",
          code: razorpayError.error?.code || "RAZORPAY_ERROR",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Create Razorpay order error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create payment order" },
      { status: 500 }
    );
  }
}
