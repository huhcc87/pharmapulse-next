// src/app/api/gst/gstins/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

export async function GET() {
  try {
    const org = await prisma.org.findUnique({
      where: { tenantId: DEMO_TENANT_ID },
      include: { gstins: true },
    });

    return NextResponse.json({
      orgId: org?.id ?? null,
      activeGstinId: org?.gstins?.find(g => g.isActive)?.id ?? null,
      gstins: org?.gstins ?? [],
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to load GSTINs" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const gstin = String(body?.gstin ?? "").trim().toUpperCase();
    const isActive = Boolean(body?.isActive ?? false);

    if (!gstin) {
      return NextResponse.json({ error: "gstin is required" }, { status: 400 });
    }

    // Ensure org exists
    const org =
      (await prisma.org.findUnique({ where: { tenantId: DEMO_TENANT_ID } })) ??
      (await prisma.org.create({
        data: {
          tenantId: DEMO_TENANT_ID,
          name: "Demo Pharmacy",
        },
      }));

    // Extract state code from GSTIN (first 2 digits)
    const stateCode = gstin.length >= 2 ? gstin.substring(0, 2) : "27"; // Default to Maharashtra
    
    const created = await prisma.orgGstin.create({
      data: {
        orgId: org.id,
        gstin,
        stateCode,
        isActive,
      },
    });

    if (isActive) {
      // Deactivate all other GSTINs for this org
      await prisma.orgGstin.updateMany({
        where: { orgId: org.id, id: { not: created.id } },
        data: { isActive: false },
      });
    }

    return NextResponse.json({ ok: true, gstin: created });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to save GSTIN" },
      { status: 500 }
    );
  }
}
