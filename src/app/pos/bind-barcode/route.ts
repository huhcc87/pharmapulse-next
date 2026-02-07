import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();
  const productId = String(body.productId || "").trim();
  const barcode = String(body.barcode || "").trim();
  const barcodeType = body.barcodeType ? String(body.barcodeType).trim() : "EAN13";

  if (!productId || !barcode) {
    return NextResponse.json({ error: "productId and barcode required" }, { status: 400 });
  }

  // Prevent duplicates
  const exists = await prisma.product.findFirst({ where: { barcode } });
  if (exists && exists.id !== Number(productId)) {
    return NextResponse.json({ error: "barcode already assigned to another product" }, { status: 409 });
  }

  const updated = await prisma.product.update({
    where: { id: Number(productId) },
    data: { barcode, barcodeType },
    select: { id: true, name: true, barcode: true, barcodeType: true },
  });

  return NextResponse.json({ ok: true, product: updated });
}
