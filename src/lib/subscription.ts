import { prisma } from "./prisma";

export type SubscriptionDecision =
  | { ok: true; warning?: string; status: string; periodEnd?: string; graceUntil?: string }
  | { ok: false; status: string; periodEnd?: string; graceUntil?: string; reason: string };

export async function getSubscriptionForTenant(tenantId: string) {
  return prisma.subscription.findUnique({ where: { tenantId } });
}

export async function evaluateSubscription(tenantId: string): Promise<SubscriptionDecision> {
  const sub = await getSubscriptionForTenant(tenantId);

  const now = new Date();

  if (!sub) {
    return { ok: false, status: "none", reason: "No subscription record" };
  }

  if (sub.status === "suspended") {
    return {
      ok: false,
      status: "suspended",
      periodEnd: sub.currentPeriodEnd?.toISOString(),
      graceUntil: sub.graceUntil?.toISOString(),
      reason: sub.lockReason || "Suspended by admin",
    };
  }

  const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const graceUntil = sub.graceUntil ? new Date(sub.graceUntil) : null;

  const active = periodEnd && periodEnd > now;
  const inGrace = !active && graceUntil && graceUntil > now;

  if (active) {
    return {
      ok: true,
      status: sub.status,
      periodEnd: sub.currentPeriodEnd?.toISOString(),
      graceUntil: sub.graceUntil?.toISOString(),
    };
  }

  if (inGrace) {
    return {
      ok: true,
      warning: "GRACE_PERIOD",
      status: sub.status,
      periodEnd: sub.currentPeriodEnd?.toISOString(),
      graceUntil: sub.graceUntil?.toISOString(),
    };
  }

  // Expired
  return {
    ok: false,
    status: "expired",
    periodEnd: sub.currentPeriodEnd?.toISOString(),
    graceUntil: sub.graceUntil?.toISOString(),
    reason: "Subscription expired",
  };
}

/** Throw 402 if expired */
export async function requireActiveSubscription(tenantId: string) {
  const decision = await evaluateSubscription(tenantId);
  if (!decision.ok) {
    const err = new Error("SUBSCRIPTION_REQUIRED");
    // @ts-ignore
    err.status = 402;
    // @ts-ignore
    err.body = {
      code: "SUBSCRIPTION_REQUIRED",
      status: decision.status,
      period_end: decision.periodEnd ?? null,
      grace_until: decision.graceUntil ?? null,
      message: decision.reason,
    };
    throw err;
  }
  return decision;
}
