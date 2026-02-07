import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const barcode = searchParams.get("barcode");
  if (!barcode) return NextResponse.json({ error: "barcode required" }, { status: 400 });

  const p = await prisma.product.findFirst({
    where: { barcode },
    select: { id: true, name: true, barcode: true, hsnCode: true, gstRate: true, gstType: true, salePrice: true },
  });

  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    ...p,
    hsn: p.hsnCode, // Map hsnCode to hsn for backward compatibility
    gstRate: p.gstRate ? Number(p.gstRate) : null,
    salePrice: Number(p.salePrice),
    taxInclusion: p.gstType || "EXCLUSIVE", // Map gstType to taxInclusion for backward compatibility
  });
}
