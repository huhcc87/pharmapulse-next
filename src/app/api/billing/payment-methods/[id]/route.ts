// Advanced Payment Methods API - Individual method operations
// GET /api/billing/payment-methods/[id] - Get payment method
// PATCH /api/billing/payment-methods/[id] - Update payment method
// DELETE /api/billing/payment-methods/[id] - Delete payment method
// POST /api/billing/payment-methods/[id]/verify - Verify payment method
// POST /api/billing/payment-methods/[id]/set-default - Set as default

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import {
  getPaymentMethods,
  updatePaymentMethod,
  deletePaymentMethod,
  verifyPaymentMethod,
  setDefaultPaymentMethod,
} from "@/lib/billing/payment-methods";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const paymentMethods = await getPaymentMethods(tenantId);
    const paymentMethod = paymentMethods.find((pm) => pm.id === id);

    if (!paymentMethod) {
      return NextResponse.json(
        { error: "Payment method not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      paymentMethod: {
        id: paymentMethod.id,
        methodType: paymentMethod.methodType,
        provider: paymentMethod.provider,
        isDefault: paymentMethod.isDefault,
        isAutoPayment: paymentMethod.isAutoPayment,
        autoPaymentRules: paymentMethod.autoPaymentRules,
        isActive: paymentMethod.isActive,
        verifiedAt: paymentMethod.verifiedAt,
        createdAt: paymentMethod.createdAt,
        // Don't expose accountDetails for security
      },
    });
  } catch (error: any) {
    console.error("Get payment method API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const tenantId = user.tenantId || "default";
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const paymentMethod = await updatePaymentMethod(tenantId, id, body);

    return NextResponse.json({
      success: true,
      paymentMethod: {
        id: paymentMethod.id,
        methodType: paymentMethod.methodType,
        provider: paymentMethod.provider,
        isDefault: paymentMethod.isDefault,
        isAutoPayment: paymentMethod.isAutoPayment,
        isActive: paymentMethod.isActive,
      },
    });
  } catch (error: any) {
    console.error("Update payment method API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const resolvedParams = await params;
    const { id } = resolvedParams;

    await deletePaymentMethod(tenantId, id);

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("Delete payment method API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
