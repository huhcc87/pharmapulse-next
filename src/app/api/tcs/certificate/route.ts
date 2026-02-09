// src/app/api/tcs/certificate/route.ts
// TCS Certificate Generation API
// POST /api/tcs/certificate - Generate TCS certificate (Form 27D)

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { generateTCSCertificate } from "@/lib/gst/tcs-certificate";

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

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = resolveTenantId(user);

    const body = await req.json();
    const { customerId, financialYear, quarter } = body ?? {};

    const customerIdNum = toInt(customerId);

    if (!customerIdNum) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    if (!financialYear) {
      return NextResponse.json(
        { error: "financialYear is required (format: 2024-25)" },
        { status: 400 }
      );
    }

    if (!quarter || !["Q1", "Q2", "Q3", "Q4"].includes(quarter)) {
      return NextResponse.json(
        { error: "quarter is required and must be Q1, Q2, Q3, or Q4" },
        { status: 400 }
      );
    }

    const result = await generateTCSCertificate({
      customerId: customerIdNum,
      financialYear,
      quarter,
      tenantId, // ✅ always number now
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "TCS certificate generation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      certificate: result.certificateData,
      certificateNumber: result.certificateNumber,
      totalTCSCollectedPaise: result.totalTCSCollectedPaise,
    });
  } catch (error: any) {
    console.error("TCS certificate API error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
