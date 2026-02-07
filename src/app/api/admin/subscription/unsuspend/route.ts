import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);
    if (user.role !== "super_admin") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const { tenantId } = await req.json();

    const sub = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) return NextResponse.json({ error: "No subscription record" }, { status: 404 });

    // If already expired, leave expired; otherwise keep active/past_due as is
    const now = new Date();
    const isActive = sub.currentPeriodEnd && sub.currentPeriodEnd > now;

    await prisma.subscription.update({
      where: { tenantId },
      data: {
        status: isActive ? "active" : "expired",
        lockReason: null,
      },
    });

    await prisma.subscriptionEvent.create({
      data: { tenantId, actor: "super_admin", type: "admin.unsuspend", payload: { by: user.email } },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
