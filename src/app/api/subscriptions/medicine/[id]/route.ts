// src/app/api/subscriptions/medicine/[id]/route.ts
// Medicine Subscription Management API
// GET /api/subscriptions/medicine/[id]

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

function toInt(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function resolveTenantId(user: any): number {
  return toInt(user?.tenantId) ?? DEMO_TENANT_ID;
}

async function readParamId(ctx: any): Promise<string | undefined> {
  const p = ctx?.params;
  if (!p) return undefined;
  const resolved = typeof p?.then === "function" ? await p : p;
  return resolved?.id;
}

export async function GET(_req: NextRequest, ctx: any) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const idStr = await readParamId(ctx);
    const idNum = toInt(idStr);

    if (idNum === undefined) {
      return NextResponse.json(
        { ok: false, error: "Invalid subscription id" },
        { status: 400 }
      );
    }

    const tenantId = resolveTenantId(user);

    // Use a universally-common sort key; swap to your real field later (e.g., deliveryDate, scheduledAt, etc.)
    // If your SubscriptionDelivery model doesn't have createdAt, change this to { id: "desc" }.
    const deliveriesOrderBy: any = { createdAt: "desc" };

    const subscription = await prisma.medicineSubscription.findFirst({
      where: {
        id: idNum,
        tenantId,
      },
      include: {
        customer: true,
        items: true,
        deliveries: { orderBy: deliveriesOrderBy },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { ok: false, error: "Subscription not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, subscription });
  } catch (err) {
    console.error("GET /api/subscriptions/medicine/[id] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
