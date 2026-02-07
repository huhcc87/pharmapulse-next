// Payment Security & Compliance API
// GET /api/billing/payments/compliance - Check PCI compliance
// GET /api/billing/payments/audit - Get payment audit trail

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { checkPCICompliance, getPaymentAuditTrail, getFraudPreventionSettings } from "@/lib/billing/payment-security";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type"); // compliance, audit, fraud-settings

    if (type === "compliance") {
      const compliance = await checkPCICompliance(tenantId);
      return NextResponse.json({ compliance });
    } else if (type === "audit") {
      const paymentId = searchParams.get("paymentId");
      if (!paymentId) {
        return NextResponse.json(
          { error: "paymentId is required" },
          { status: 400 }
        );
      }
      const auditTrail = await getPaymentAuditTrail(tenantId, paymentId);
      return NextResponse.json({ auditTrail });
    } else if (type === "fraud-settings") {
      const settings = await getFraudPreventionSettings(tenantId);
      return NextResponse.json({ settings });
    } else {
      // Return all
      const [compliance, settings] = await Promise.all([
        checkPCICompliance(tenantId),
        getFraudPreventionSettings(tenantId),
      ]);

      return NextResponse.json({
        compliance,
        fraudPrevention: settings,
      });
    }
  } catch (error: any) {
    console.error("Payment compliance API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
