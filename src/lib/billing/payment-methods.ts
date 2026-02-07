// Advanced Payment Methods Management
// Support for UPI, NEFT, RTGS, IMPS, Card, Wallet

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
 * Create payment method
 */
export async function createPaymentMethod(
  tenantId: string,
  data: PaymentMethodData
): Promise<any> {
  try {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.paymentMethod.updateMany({
        where: {
          tenantId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Create payment method
    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        tenantId,
        methodType: data.methodType,
        provider: data.provider || null,
        accountDetails: data.accountDetails
          ? JSON.parse(JSON.stringify(data.accountDetails))
          : null,
        isDefault: data.isDefault || false,
        isAutoPayment: data.isAutoPayment || false,
        autoPaymentRules: data.autoPaymentRules
          ? JSON.parse(JSON.stringify(data.autoPaymentRules))
          : null,
        isActive: true,
        verifiedAt: null,
      },
    });

    return paymentMethod;
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
  try {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.paymentMethod.updateMany({
        where: {
          tenantId,
          isDefault: true,
          id: {
            not: methodId,
          },
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Update payment method
    const updateData: any = {};
    if (data.methodType) updateData.methodType = data.methodType;
    if (data.provider !== undefined) updateData.provider = data.provider;
    if (data.accountDetails) updateData.accountDetails = JSON.parse(JSON.stringify(data.accountDetails));
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.isAutoPayment !== undefined) updateData.isAutoPayment = data.isAutoPayment;
    if (data.autoPaymentRules) updateData.autoPaymentRules = JSON.parse(JSON.stringify(data.autoPaymentRules));

    const paymentMethod = await prisma.paymentMethod.update({
      where: {
        id: methodId,
        tenantId,
      },
      data: updateData,
    });

    return paymentMethod;
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
  try {
    await prisma.paymentMethod.delete({
      where: {
        id: methodId,
        tenantId,
      },
    });
  } catch (error: any) {
    console.error("Delete payment method error:", error);
    throw error;
  }
}

/**
 * Get payment methods
 */
export async function getPaymentMethods(
  tenantId: string,
  filters?: {
    methodType?: string;
    isActive?: boolean;
    isDefault?: boolean;
  }
): Promise<any[]> {
  try {
    const where: any = { tenantId };
    if (filters?.methodType) {
      where.methodType = filters.methodType;
    }
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }
    if (filters?.isDefault !== undefined) {
      where.isDefault = filters.isDefault;
    }

    const paymentMethods = await prisma.paymentMethod.findMany({
      where,
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
    });

    return paymentMethods;
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
  try {
    // In a real implementation, this would:
    // 1. Send verification code to account
    // 2. Verify the code
    // 3. Mark as verified

    // For now, just mark as verified
    const paymentMethod = await prisma.paymentMethod.update({
      where: {
        id: methodId,
        tenantId,
      },
      data: {
        verifiedAt: new Date(),
      },
    });

    return paymentMethod;
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
  try {
    // Unset all defaults
    await prisma.paymentMethod.updateMany({
      where: {
        tenantId,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });

    // Set new default
    const paymentMethod = await prisma.paymentMethod.update({
      where: {
        id: methodId,
        tenantId,
      },
      data: {
        isDefault: true,
      },
    });

    return paymentMethod;
  } catch (error: any) {
    console.error("Set default payment method error:", error);
    throw error;
  }
}
