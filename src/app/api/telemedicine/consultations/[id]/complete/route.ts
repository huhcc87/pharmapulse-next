// src/app/api/telemedicine/consultations/[id]/complete/route.ts
// Complete Consultation API
// POST /api/telemedicine/consultations/[id]/complete
// Complete consultation and generate e-prescription

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { completeConsultation } from "@/lib/telemedicine/consultation-manager";

const DEMO_TENANT_ID = 1;

function toInt(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n =
    typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function resolveTenantId(user: any): number {
  return toInt(user?.tenantId) ?? DEMO_TENANT_ID;
}

async function readParamId(ctx: any): Promise<string | undefined> {
  const p = ctx?.params;
  if (!p) return undefined;
  const resolved = typeof p?.then === "function" ? await p : p;
  return resolved?.id;
}

export async function POST(req: NextRequest, ctx: any) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = resolveTenantId(user);

    const idStr = await readParamId(ctx);
    const consultationId = toInt(idStr);

    if (!consultationId) {
      return NextResponse.json(
        { error: "Invalid consultation id" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { diagnosis, prescriptionLines } = body ?? {};

    if (!diagnosis) {
      return NextResponse.json(
        { error: "diagnosis is required" },
        { status: 400 }
      );
    }

    if (
      !prescriptionLines ||
      !Array.isArray(prescriptionLines) ||
      prescriptionLines.length === 0
    ) {
      return NextResponse.json(
        { error: "prescriptionLines array is required" },
        { status: 400 }
      );
    }

    const result = await completeConsultation(
      consultationId,
      diagnosis,
      prescriptionLines,
      tenantId // ✅ always number
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Consultation completion failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      prescriptionId: result.prescriptionId,
      message: "Consultation completed and e-prescription generated",
    });
  } catch (error: any) {
    console.error("Complete consultation API error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
