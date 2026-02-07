import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json([], { status: 200 });

  const list = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { internalCode: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q, mode: "insensitive" } },
      ],
      isActive: true,
    },
    take: 20,
    select: { id: true, name: true, barcode: true, hsnCode: true, gstRate: true, gstType: true, salePrice: true },
  });

  return NextResponse.json(
    list.map((p) => ({
      ...p,
      hsn: p.hsnCode, // Map hsnCode to hsn for backward compatibility
      gstRate: p.gstRate ? Number(p.gstRate) : null,
      salePrice: Number(p.salePrice),
      taxInclusion: p.gstType || "EXCLUSIVE", // Map gstType to taxInclusion for backward compatibility
    }))
  );
}
