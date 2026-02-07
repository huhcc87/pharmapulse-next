import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const take = parseInt(searchParams.get("take") || "20");
  
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
    take: Math.min(take, 100), // Cap at 100
    select: { 
      id: true, 
      name: true, 
      barcode: true,
      barcodeType: true,
      internalCode: true,
      labelName: true,
      mrp: true,
      hsnCode: true,
      gstRate: true, 
      gstType: true, 
      salePrice: true,
      unitPrice: true,
    },
  });

  return NextResponse.json(
    list.map((p) => ({
      id: String(p.id),
      name: p.name,
      labelName: p.labelName || null,
      barcode: p.barcode || null,
      barcodeType: p.barcodeType || null,
      internalCode: p.internalCode || null,
      mrp: p.mrp ? Number(p.mrp) : null,
      hsn: p.hsnCode || null,
      gstRate: p.gstRate ? Number(p.gstRate) : null,
      gstType: (p.gstType as "EXCLUSIVE" | "INCLUSIVE") || "EXCLUSIVE",
      salePrice: Number(p.salePrice ?? p.unitPrice),
    }))
  );
}

