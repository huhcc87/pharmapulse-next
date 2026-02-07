import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const list = await prisma.saleDraft.findMany({
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: { items: true },
  });
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const body = await req.json();
  const sellerStateCode = String(body.sellerStateCode || "").trim();
  const buyerStateCode = String(body.buyerStateCode || "").trim();
  const buyerGstin = body.buyerGstin ? String(body.buyerGstin).trim() : null;
  const items = Array.isArray(body.items) ? body.items : [];

  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;
  const countToday = await prisma.saleDraft.count({
    where: { draftNo: { startsWith: `DR-${ymd}-` } },
  });
  const seq = String(countToday + 1).padStart(4, "0");
  const draftNo = `DR-${ymd}-${seq}`;

  const created = await prisma.saleDraft.create({
    data: {
      draftNo,
      sellerStateCode,
      buyerStateCode,
      buyerGstin,
      items: {
        create: items.map((x: any) => ({
          productId: x.id,
          name: String(x.name || "Item"),
          barcode: x.barcode ?? null,
          hsn: x.hsn ?? null,
          gstRate: x.gstRate ?? 0,
          gstType: x.gstType === "INCLUSIVE" ? "INCLUSIVE" : "EXCLUSIVE",
          qty: Math.max(1, Math.floor(Number(x.qty || 1))),
          unitPrice: Number(x.unitPrice || 0),
          discount: Number(x.discount || 0),
        })),
      },
    },
    select: { id: true, draftNo: true },
  });

  return NextResponse.json(created);
}
