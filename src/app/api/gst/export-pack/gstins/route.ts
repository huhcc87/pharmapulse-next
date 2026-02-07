import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export async function GET() {
  // TEMP: hardcode tenantId=1 until auth is wired
  const tenantId = 1;

  const org = await prisma.org.findUnique({ where: { tenantId }, include: { gstins: true } });
  if (!org) return NextResponse.json({ items: [] });

  return NextResponse.json({
    items: org.gstins.filter((g) => g.isActive).map((g) => ({
      id: g.id,
      gstin: g.gstin,
      stateCode: g.stateCode,
      legalName: g.legalName,
      invoicePrefix: g.invoicePrefix,
    })),
  });
}
