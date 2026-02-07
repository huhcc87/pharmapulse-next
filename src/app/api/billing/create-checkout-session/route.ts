import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getPlanFeatures, getPlanAiCredits, PLAN_CONFIGS } from "@/lib/subscription-features";

// Map plan names to Stripe price IDs (from environment variables)
const PLAN_PRICE_IDS: Record<string, { monthly?: string; yearly?: string }> = {
  basic: {
    monthly: process.env.STRIPE_PRICE_ID_BASIC_MONTHLY,
    yearly: process.env.STRIPE_PRICE_ID_BASIC_YEARLY,
  },
  professional: {
    monthly: process.env.STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY,
    yearly: process.env.STRIPE_PRICE_ID_PROFESSIONAL_YEARLY,
  },
  enterprise: {
    monthly: process.env.STRIPE_PRICE_ID_ENTERPRISE_MONTHLY,
    yearly: process.env.STRIPE_PRICE_ID_ENTERPRISE_YEARLY,
  },
  // Fallback for existing annual plan
  annual: {
    yearly: process.env.STRIPE_PRICE_ID_ANNUAL,
  },
};

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Please log in to create checkout session' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { plan = "professional", billingCycle = "yearly" } = body;

    // Validate plan
    if (!PLAN_CONFIGS[plan.toLowerCase()]) {
      return NextResponse.json(
        { error: `Invalid plan: ${plan}. Valid plans: basic, professional, enterprise` },
        { status: 400 }
      );
    }

    // Get price ID for plan and billing cycle
    const priceConfig = PLAN_PRICE_IDS[plan.toLowerCase()] || PLAN_PRICE_IDS.annual;
    const priceId =
      billingCycle === "monthly" ? priceConfig.monthly : priceConfig.yearly || priceConfig.monthly;

    if (!priceId) {
      return NextResponse.json(
        {
          error: `Price ID not configured for plan: ${plan} (${billingCycle}). Please configure STRIPE_PRICE_ID_${plan.toUpperCase()}_${billingCycle.toUpperCase()}`,
        },
        { status: 500 }
      );
    }

    // Ensure tenant exists
    await prisma.tenant.upsert({
      where: { id: user.tenantId },
      update: {},
      create: { id: user.tenantId },
    });

    const existing = await prisma.subscription.findUnique({ where: { tenantId: user.tenantId } });

    // Get Stripe instance (will throw if not configured)
    let stripe;
    try {
      stripe = getStripe();
    } catch (stripeError: any) {
      return NextResponse.json(
        { error: 'Payment provider not configured', message: stripeError.message || 'Stripe is not set up. Please configure STRIPE_SECRET_KEY.' },
        { status: 503 }
      );
    }

    // If we already have a stripe customer, reuse it
    let customerId = existing?.stripeCustomerId ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { tenantId: user.tenantId },
      });
      customerId = customer.id;

      // Initialize subscription with plan features
      const features = getPlanFeatures(plan);
      const aiCredits = getPlanAiCredits(plan);

      await prisma.subscription.upsert({
        where: { tenantId: user.tenantId },
        update: { stripeCustomerId: customerId },
        create: {
          tenantId: user.tenantId,
          status: "expired",
          plan: plan.toLowerCase(),
          stripeCustomerId: customerId,
          featuresJson: JSON.parse(JSON.stringify(features)),
          aiCredits,
        },
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      success_url: `${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/billing?success=1`,
      cancel_url: `${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/billing?canceled=1`,
      metadata: {
        tenantId: user.tenantId,
        plan: plan.toLowerCase(),
        billingCycle,
      },
      subscription_data: {
        metadata: {
          tenantId: user.tenantId,
          plan: plan.toLowerCase(),
        },
      },
    });

    // Audit log
    await prisma.subscriptionEvent.create({
      data: {
        tenantId: user.tenantId,
        type: "checkout.session.created",
        actor: "user",
        payload: {
          plan,
          billingCycle,
          sessionId: session.id,
        },
      },
    }).catch((err) => {
      console.error("Failed to log checkout event:", err);
      // Don't fail the request if audit log fails
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e: any) {
    console.error("Checkout session creation error:", e);
    return NextResponse.json({ error: e?.message || "Failed to create checkout session" }, { status: e?.status || 500 });
  }
}
