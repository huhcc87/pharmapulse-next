import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);
    if (user.role !== "super_admin") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const { tenantId, reason } = await req.json();

    await prisma.subscription.upsert({
      where: { tenantId },
      update: { status: "suspended", lockReason: reason || "Suspended by admin" },
      create: { tenantId, status: "suspended", lockReason: reason || "Suspended by admin" },
    });

    await prisma.subscriptionEvent.create({
      data: { tenantId, actor: "super_admin", type: "admin.suspend", payload: { reason, by: user.email } },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
