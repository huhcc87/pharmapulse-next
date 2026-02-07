import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST() {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please log in to access billing portal" },
        { status: 401 }
      );
    }

    const sub = await prisma.subscription.findUnique({ where: { tenantId: user.tenantId } });
    if (!sub?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer found", message: "You need to subscribe first before accessing the billing portal" },
        { status: 400 }
      );
    }

    let session;
    try {
      const stripe = getStripe(); // Get stripe instance (throws if not configured)
      session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/settings?tab=billing`,
      });
    } catch (stripeError: any) {
      console.error("Stripe portal session error:", stripeError);
      const errorMessage = stripeError?.message || "Failed to create billing portal session";
      
      if (errorMessage.includes('STRIPE_SECRET_KEY') || errorMessage.includes('not configured')) {
        return NextResponse.json(
          { error: "Payment provider not configured", message: "Stripe is not set up. Please configure STRIPE_SECRET_KEY in your environment variables." },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { error: "Payment provider error", message: errorMessage },
        { status: 503 }
      );
    }

    // Audit log (non-blocking)
    try {
      await prisma.subscriptionEvent.create({
        data: {
          tenantId: user.tenantId,
          type: "billing.portal.accessed",
          actor: "user",
          payload: {
            sessionId: session.id,
          },
        },
      });
    } catch (err) {
      console.error("Failed to log portal access (non-fatal):", err);
      // Don't fail the request if audit log fails
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e: any) {
    console.error("Portal session creation error:", e);
    
    // Always return JSON, never HTML
    const errorMessage = e?.message || "Failed to create portal session";
    
    if (e?.status === 401 || errorMessage.includes('UNAUTHORIZED')) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: errorMessage },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: e?.status || 500 }
    );
  }
}
