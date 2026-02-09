// src/lib/billing/payment-methods.ts
// Advanced Payment Methods Management
// Support for UPI, NEFT, RTGS, IMPS, Card, Wallet

import { prisma } from "@/lib/prisma";

export interface PaymentMethodData {
  methodType: "UPI" | "NEFT" | "RTGS" | "IMPS" | "CARD" | "WALLET";
  provider?: string;
  accountDetails?: {
    accountNumber?: string;
    ifscCode?: string;
    upiId?: string;
    bankName?: string;
    accountHolderName?: string;
    [key: string]: any;
  };
  isDefault?: boolean;
  isAutoPayment?: boolean;
  autoPaymentRules?: {
    minAmount?: number;
    maxAmount?: number;
    categories?: string[];
  };
}

/**
 * Your current Prisma schema does NOT expose `prisma.paymentMethod`.
 * This file is therefore written to:
 *  - compile cleanly even without that model
 *  - degrade gracefully at runtime
 *
 * If/when you add a PaymentMethod model to schema.prisma, this will start using it automatically.
 */
type PaymentMethodDelegate = {
  findMany: (args: any) => Promise<any[]>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  updateMany: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
};

function getPaymentMethodDelegate(): PaymentMethodDelegate | null {
  const anyPrisma = prisma as any;
  return (anyPrisma?.paymentMethod ?? null) as PaymentMethodDelegate | null;
}

function requirePaymentMethodModel(): PaymentMethodDelegate {
  const delegate = getPaymentMethodDelegate();
  if (!delegate) {
    throw new Error(
      "PaymentMethod model is not available in Prisma schema. Add `model PaymentMethod` (and run prisma generate) to enable payment methods."
    );
  }
  return delegate;
}

/**
 * Create payment method
 */
export async function createPaymentMethod(
  tenantId: string,
  data: PaymentMethodData
): Promise<any> {
  const paymentMethod = requirePaymentMethodModel();

  try {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await paymentMethod.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Create payment method
    return await paymentMethod.create({
      data: {
        tenantId,
        methodType: data.methodType,
        provider: data.provider ?? null,
        accountDetails: data.accountDetails
          ? JSON.parse(JSON.stringify(data.accountDetails))
          : null,
        isDefault: data.isDefault ?? false,
        isAutoPayment: data.isAutoPayment ?? false,
        autoPaymentRules: data.autoPaymentRules
          ? JSON.parse(JSON.stringify(data.autoPaymentRules))
          : null,
        isActive: true,
        verifiedAt: null,
      },
    });
  } catch (error: any) {
    console.error("Create payment method error:", error);
    throw error;
  }
}

/**
 * Update payment method
 */
export async function updatePaymentMethod(
  tenantId: string,
  methodId: string,
  data: Partial<PaymentMethodData>
): Promise<any> {
  const paymentMethod = requirePaymentMethodModel();

  try {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await paymentMethod.updateMany({
        where: {
          tenantId,
          isDefault: true,
          id: { not: methodId },
        },
        data: { isDefault: false },
      });
    }

    const updateData: any = {};
    if (data.methodType) updateData.methodType = data.methodType;
    if (data.provider !== undefined) updateData.provider = data.provider ?? null;
    if (data.accountDetails !== undefined) {
      updateData.accountDetails = data.accountDetails
        ? JSON.parse(JSON.stringify(data.accountDetails))
        : null;
    }
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.isAutoPayment !== undefined) updateData.isAutoPayment = data.isAutoPayment;
    if (data.autoPaymentRules !== undefined) {
      updateData.autoPaymentRules = data.autoPaymentRules
        ? JSON.parse(JSON.stringify(data.autoPaymentRules))
        : null;
    }

    return await paymentMethod.update({
      where: { id: methodId, tenantId },
      data: updateData,
    });
  } catch (error: any) {
    console.error("Update payment method error:", error);
    throw error;
  }
}

/**
 * Delete payment method
 */
export async function deletePaymentMethod(
  tenantId: string,
  methodId: string
): Promise<void> {
  const paymentMethod = requirePaymentMethodModel();

  try {
    await paymentMethod.delete({
      where: { id: methodId, tenantId },
    });
  } catch (error: any) {
    console.error("Delete payment method error:", error);
    throw error;
  }
}

/**
 * Get payment methods
 *
 * If model is missing, return [] (so UI can still load).
 */
export async function getPaymentMethods(
  tenantId: string,
  filters?: {
    methodType?: string;
    isActive?: boolean;
    isDefault?: boolean;
  }
): Promise<any[]> {
  const paymentMethod = getPaymentMethodDelegate();
  if (!paymentMethod) return [];

  try {
    const where: any = { tenantId };
    if (filters?.methodType) where.methodType = filters.methodType;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.isDefault !== undefined) where.isDefault = filters.isDefault;

    return await paymentMethod.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  } catch (error: any) {
    console.error("Get payment methods error:", error);
    throw error;
  }
}

/**
 * Verify payment method
 */
export async function verifyPaymentMethod(
  tenantId: string,
  methodId: string
): Promise<any> {
  const paymentMethod = requirePaymentMethodModel();

  try {
    return await paymentMethod.update({
      where: { id: methodId, tenantId },
      data: { verifiedAt: new Date() },
    });
  } catch (error: any) {
    console.error("Verify payment method error:", error);
    throw error;
  }
}

/**
 * Set default payment method
 */
export async function setDefaultPaymentMethod(
  tenantId: string,
  methodId: string
): Promise<any> {
  const paymentMethod = requirePaymentMethodModel();

  try {
    await paymentMethod.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });

    return await paymentMethod.update({
      where: { id: methodId, tenantId },
      data: { isDefault: true },
    });
  } catch (error: any) {
    console.error("Set default payment method error:", error);
    throw error;
  }
}
