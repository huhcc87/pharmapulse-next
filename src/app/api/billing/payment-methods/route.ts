// Advanced Payment Methods API
// GET /api/billing/payment-methods - List payment methods
// POST /api/billing/payment-methods - Create payment method

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import {
  createPaymentMethod,
  getPaymentMethods,
  updatePaymentMethod,
  deletePaymentMethod,
  verifyPaymentMethod,
  setDefaultPaymentMethod,
} from "@/lib/billing/payment-methods";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const methodType = searchParams.get("methodType");
    const isActive = searchParams.get("isActive");
    const isDefault = searchParams.get("isDefault");

    const filters: any = {};
    if (methodType) filters.methodType = methodType;
    if (isActive !== null) filters.isActive = isActive === "true";
    if (isDefault !== null) filters.isDefault = isDefault === "true";

    const paymentMethods = await getPaymentMethods(tenantId, filters);

    return NextResponse.json({
      paymentMethods: paymentMethods.map((pm) => ({
        id: pm.id,
        methodType: pm.methodType,
        provider: pm.provider,
        isDefault: pm.isDefault,
        isAutoPayment: pm.isAutoPayment,
        isActive: pm.isActive,
        verifiedAt: pm.verifiedAt,
        createdAt: pm.createdAt,
        // Don't expose accountDetails for security
      })),
    });
  } catch (error: any) {
    console.error("Get payment methods API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { methodType, provider, accountDetails, isDefault, isAutoPayment, autoPaymentRules } = body;

    if (!methodType) {
      return NextResponse.json(
        { error: "methodType is required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";

    const paymentMethod = await createPaymentMethod(tenantId, {
      methodType,
      provider,
      accountDetails,
      isDefault,
      isAutoPayment,
      autoPaymentRules,
    });

    return NextResponse.json({
      success: true,
      paymentMethod: {
        id: paymentMethod.id,
        methodType: paymentMethod.methodType,
        provider: paymentMethod.provider,
        isDefault: paymentMethod.isDefault,
        isAutoPayment: paymentMethod.isAutoPayment,
        isActive: paymentMethod.isActive,
        createdAt: paymentMethod.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Create payment method API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/billing/payment-methods - Update payment method
export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";

    const paymentMethod = await updatePaymentMethod(tenantId, id, updateData);

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

// DELETE /api/billing/payment-methods - Delete payment method
export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";

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
