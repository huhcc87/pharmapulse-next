// src/app/api/security/analytics/route.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Analytics step-up API (placeholder-safe)
 * NOTE: Wire this to your real step-up verification logic after deployment is stable.
 */

// Optional: simple GET for health/debug
export async function GET() {
  return NextResponse.json({ ok: true, message: "analytics route alive" });
}

// ✅ Correct signature: POST (no markdown formatting)
export async function POST(_request: NextRequest) {
  // TODO: read body + verify step-up code/token here
  // const body = await request.json();

  return NextResponse.json({ ok: true, unlocked: true });
}
