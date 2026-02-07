// Medicine Subscription Service
// Manages recurring medicine subscriptions for customers

import { prisma } from "@/lib/prisma";

export interface CreateSubscriptionInput {
  customerId: number;
  subscriptionType: "MONTHLY" | "QUARTERLY" | "YEARLY";
  items: Array<{
    productId?: number;
    drugLibraryId?: number;
    productName: string;
    quantity: number;
    unitPricePaise: number;
  }>;
  startDate: Date;
  autoDelivery: boolean;
  deliveryAddress?: string;
  paymentMethod?: "CASH" | "UPI" | "CARD" | "CREDIT";
  tenantId?: number;
}

export interface SubscriptionResult {
  success: boolean;
  subscriptionId?: number;
  subscriptionNumber?: string;
  error?: string;
}

/**
 * Create medicine subscription
 */
export async function createMedicineSubscription(
  input: CreateSubscriptionInput
): Promise<SubscriptionResult> {
  try {
    const {
      customerId,
      subscriptionType,
      items,
      startDate,
      autoDelivery,
      deliveryAddress,
      paymentMethod,
      tenantId = 1,
    } = input;

    // Validate customer
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return {
        success: false,
        error: "Customer not found",
      };
    }

    // Generate subscription number
    const subscriptionNumber = await generateSubscriptionNumber(tenantId);

    // Calculate next delivery date based on subscription type
    const nextDeliveryDate = calculateNextDeliveryDate(startDate, subscriptionType);

    // Create subscription
    const subscription = await prisma.medicineSubscription.create({
      data: {
        tenantId,
        customerId,
        subscriptionNumber,
        subscriptionType,
        status: "ACTIVE",
        startDate,
        nextDeliveryDate,
        autoDelivery,
        deliveryAddress: deliveryAddress || customer.billingAddress || null,
        paymentMethod: paymentMethod || "CASH",
        items: {
          create: items.map((item) => ({
            productId: item.productId || null,
            drugLibraryId: item.drugLibraryId || null,
            productName: item.productName,
            quantity: item.quantity,
            unitPricePaise: item.unitPricePaise,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return {
      success: true,
      subscriptionId: subscription.id,
      subscriptionNumber: subscription.subscriptionNumber,
    };
  } catch (error: any) {
    console.error("Medicine subscription creation error:", error);
    return {
      success: false,
      error: error.message || "Subscription creation failed",
    };
  }
}

/**
 * Calculate next delivery date based on subscription type
 */
function calculateNextDeliveryDate(
  startDate: Date,
  subscriptionType: "MONTHLY" | "QUARTERLY" | "YEARLY"
): Date {
  const nextDate = new Date(startDate);

  if (subscriptionType === "MONTHLY") {
    nextDate.setMonth(nextDate.getMonth() + 1);
  } else if (subscriptionType === "QUARTERLY") {
    nextDate.setMonth(nextDate.getMonth() + 3);
  } else if (subscriptionType === "YEARLY") {
    nextDate.setFullYear(nextDate.getFullYear() + 1);
  }

  return nextDate;
}

/**
 * Generate subscription number
 * Format: SUB/YYYY-MM/0001
 */
async function generateSubscriptionNumber(tenantId: number): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `SUB/${year}-${month}`;

  // Find last subscription for this month
  const lastSubscription = await prisma.medicineSubscription.findFirst({
    where: {
      tenantId,
      subscriptionNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      subscriptionNumber: "desc",
    },
  });

  let nextNumber = 1;
  if (lastSubscription && lastSubscription.subscriptionNumber) {
    const parts = lastSubscription.subscriptionNumber.split("/");
    if (parts.length === 3) {
      const lastNumber = parseInt(parts[2] || "0");
      nextNumber = lastNumber + 1;
    }
  }

  return `${prefix}/${String(nextNumber).padStart(4, "0")}`;
}

/**
 * Process subscription delivery
 * Creates invoice and delivery record for subscription
 */
export async function processSubscriptionDelivery(
  subscriptionId: number,
  tenantId: number = 1
): Promise<{ success: boolean; invoiceId?: number; error?: string }> {
  try {
    const subscription = await prisma.medicineSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        customer: true,
        items: true,
      },
    });

    if (!subscription) {
      return {
        success: false,
        error: "Subscription not found",
      };
    }

    if (subscription.status !== "ACTIVE") {
      return {
        success: false,
        error: "Subscription is not active",
      };
    }

    // Check if delivery is due
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextDelivery = new Date(subscription.nextDeliveryDate);
    nextDelivery.setHours(0, 0, 0, 0);

    if (nextDelivery > today) {
      return {
        success: false,
        error: "Delivery not due yet",
      };
    }

    // Create invoice for subscription items
    // This would integrate with the invoice creation logic
    // For now, return placeholder
    return {
      success: true,
      invoiceId: undefined, // Would be created by invoice service
    };
  } catch (error: any) {
    console.error("Subscription delivery processing error:", error);
    return {
      success: false,
      error: error.message || "Subscription delivery processing failed",
    };
  }
}

/**
 * Update subscription (pause, cancel, modify)
 */
export async function updateSubscription(
  subscriptionId: number,
  updates: {
    status?: "ACTIVE" | "PAUSED" | "CANCELLED";
    nextDeliveryDate?: Date;
    autoDelivery?: boolean;
    items?: Array<{
      productId?: number;
      drugLibraryId?: number;
      productName: string;
      quantity: number;
      unitPricePaise: number;
    }>;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: any = {};

    if (updates.status) {
      updateData.status = updates.status;
    }
    if (updates.nextDeliveryDate) {
      updateData.nextDeliveryDate = updates.nextDeliveryDate;
    }
    if (updates.autoDelivery !== undefined) {
      updateData.autoDelivery = updates.autoDelivery;
    }

    await prisma.medicineSubscription.update({
      where: { id: subscriptionId },
      data: updateData,
    });

    // Update items if provided
    if (updates.items) {
      // Delete existing items
      await prisma.medicineSubscriptionItem.deleteMany({
        where: { subscriptionId },
      });

      // Create new items
      await prisma.medicineSubscriptionItem.createMany({
        data: updates.items.map((item) => ({
          subscriptionId,
          productId: item.productId || null,
          drugLibraryId: item.drugLibraryId || null,
          productName: item.productName,
          quantity: item.quantity,
          unitPricePaise: item.unitPricePaise,
        })),
      });
    }

    return {
      success: true,
    };
  } catch (error: any) {
    console.error("Subscription update error:", error);
    return {
      success: false,
      error: error.message || "Subscription update failed",
    };
  }
}
