// src/app/api/security/analytics/product-/route.ts
import { NextResponse } from "next/server";

/**
 * Analytics: products endpoint (placeholder-safe)
 * NOTE: Replace `data` with your real DB query once build passes.
 */
export async function GET() {
  const data: any[] = []; // ✅ valid placeholder (prevents TS syntax error)
  return NextResponse.json({ success: true, data });
}
