import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // accept both ?code=INMED-000001 and ?qrCode=INMED-000001
    const code = (searchParams.get("code") || searchParams.get("qrCode") || "").trim();

    if (!code) {
      return NextResponse.json({ success: false, error: "Missing code" }, { status: 400 });
    }

    // ✅ MrDrugLibrary delegate
    // If your Prisma field is qrCode (camelCase), use qrCode.
    // If your Prisma field is qr_code (snake_case), use qr_code.
    // This query tries both safely using `any`.
    const row =
      (await prisma.drugLibrary.findFirst({ where: { qrCode: code } }).catch(() => null)) ||
      (await (prisma.drugLibrary as any).findFirst({ where: { qr_code: code } }).catch(() => null));

    if (!row) {
      return NextResponse.json({ success: true, drug: null }, { status: 200 });
    }

    const drug = {
      id: row.id,
      brandName: row.brandName ?? row.brand_name ?? null,
      manufacturer: row.manufacturer ?? null,
      priceInr: row.priceInr ?? row.price_inr ?? null,
      isDiscontinued: row.isDiscontinued ?? row.is_discontinued ?? null,
      type: row.type ?? null,
      category: row.category ?? null,
      packSize: row.packSize ?? row.pack_size ?? null,
      fullComposition: row.fullComposition ?? row.full_composition ?? null,
      salts: row.salts ?? null,
      qrCode: row.qrCode ?? row.qr_code ?? null,
      qrPayload: row.qrPayload ?? row.qr_payload ?? null,
    };

    return NextResponse.json({ success: true, drug }, { status: 200 });
  } catch (e) {
    console.error("by-qr error:", e);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
