import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);
    if (user.role !== "super_admin") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const { tenantId, extendDays, graceDays } = await req.json();

    const sub = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) return NextResponse.json({ error: "No subscription record" }, { status: 404 });

    const now = new Date();
    const periodEnd = sub.currentPeriodEnd ?? now;
    const graceUntil = sub.graceUntil ?? null;

    const newPeriodEnd =
      typeof extendDays === "number"
        ? new Date(periodEnd.getTime() + extendDays * 24 * 60 * 60 * 1000)
        : periodEnd;

    const newGraceUntil =
      typeof graceDays === "number"
        ? new Date((graceUntil ?? now).getTime() + graceDays * 24 * 60 * 60 * 1000)
        : graceUntil;

    await prisma.subscription.update({
      where: { tenantId },
      data: {
        currentPeriodEnd: newPeriodEnd,
        graceUntil: newGraceUntil ?? undefined,
      },
    });

    await prisma.subscriptionEvent.create({
      data: {
        tenantId,
        actor: "super_admin",
        type: "admin.extend",
        payload: { extendDays, graceDays, by: user.email },
      },
    });

    return NextResponse.json({ ok: true, currentPeriodEnd: newPeriodEnd, graceUntil: newGraceUntil });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
