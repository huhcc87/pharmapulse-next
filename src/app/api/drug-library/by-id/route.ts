import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idStr = (searchParams.get("id") || "").trim();

    if (!idStr) {
      return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
    }

    const id = Number(idStr);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    // ✅ MrDrugLibrary delegate
    const row = await prisma.drugLibrary.findFirst({ where: { id } });

    if (!row) {
      return NextResponse.json({ success: true, drug: null }, { status: 200 });
    }

    // Works if your Prisma fields are camelCase.
    // If your schema uses snake_case fields, see NOTE below.
    const drug = {
      id: row.id,
      brandName: (row as any).brandName ?? (row as any).brand_name ?? null,
      manufacturer: (row as any).manufacturer ?? null,
      priceInr: (row as any).priceInr ?? (row as any).price_inr ?? null,
      isDiscontinued: (row as any).isDiscontinued ?? (row as any).is_discontinued ?? null,
      type: (row as any).type ?? null,
      category: (row as any).category ?? null,
      packSize: (row as any).packSize ?? (row as any).pack_size ?? null,
      fullComposition: (row as any).fullComposition ?? (row as any).full_composition ?? null,
      salts: (row as any).salts ?? null,
      qrCode: (row as any).qrCode ?? (row as any).qr_code ?? null,
      qrPayload: (row as any).qrPayload ?? (row as any).qr_payload ?? null,
    };

    return NextResponse.json({ success: true, drug }, { status: 200 });
  } catch (e) {
    console.error("by-id error:", e);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
