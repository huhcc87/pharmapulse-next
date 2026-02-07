// Payment Audit Trail API
// GET /api/billing/payments/audit

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { getPaymentAuditTrail } from "@/lib/billing/payment-security";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const paymentId = searchParams.get("paymentId");

    if (!paymentId) {
      return NextResponse.json(
        { error: "paymentId is required" },
        { status: 400 }
      );
    }

    const auditTrail = await getPaymentAuditTrail(tenantId, paymentId);

    return NextResponse.json({
      auditTrail,
    });
  } catch (error: any) {
    console.error("Get payment audit trail API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
