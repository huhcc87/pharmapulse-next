// src/app/api/barcode/resolve/route.ts
import { NextResponse } from "next/server";
import { resolveBarcodeServer } from "@/lib/barcode/resolver.server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const code = searchParams.get("code") || "";
  const tenantId = Number(searchParams.get("tenantId") || "1");
  const branchId = Number(searchParams.get("branchId") || "1");

  if (!code) {
    return NextResponse.json({ ok: false, error: "Missing code" }, { status: 400 });
  }

  const result = await resolveBarcodeServer(code, tenantId, branchId);
  return NextResponse.json({ ok: true, result });
}
