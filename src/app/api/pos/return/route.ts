import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();
  const invoiceId = String(body.invoiceId || "").trim();
  if (!invoiceId) return NextResponse.json({ error: "invoiceId required" }, { status: 400 });

  const inv = await prisma.invoice.findUnique({
    where: { id: Number(invoiceId) },
    include: { lineItems: true, taxLines: true },
  }) as any;
  if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });

  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;
  const countToday = await prisma.invoice.count({
    where: { invoiceNumber: { startsWith: `CN-${ymd}-` } },
  });
  const seq = String(countToday + 1).padStart(4, "0");
  const invoiceNo = `CN-${ymd}-${seq}`;

  // Note: This route needs updating to match current Invoice schema
  // For now, return error as this functionality needs to be reimplemented
  return NextResponse.json(
    { error: "Return functionality needs to be updated for current schema" },
    { status: 501 }
  );

  // Return functionality temporarily disabled - needs schema update
}
