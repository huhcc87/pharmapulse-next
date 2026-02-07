// SMS Notification Templates and Helpers
// Pre-built SMS templates for common pharmacy notifications

import { sendSMS, normalizePhoneNumber } from "./sms-client";

export interface OrderConfirmationSMSInput {
  customerPhone: string;
  customerName: string;
  orderNumber: string;
  totalAmount: number; // in rupees
  estimatedDelivery?: string;
}

export interface PrescriptionRefillReminderInput {
  customerPhone: string;
  customerName: string;
  prescriptionNumber: string;
  medicineName: string;
  daysUntilRefill: number;
}

export interface StockArrivalAlertInput {
  customerPhone: string;
  customerName: string;
  productName: string;
  isAvailable: boolean;
}

export interface PaymentReminderInput {
  customerPhone: string;
  customerName: string;
  dueAmount: number; // in rupees
  dueDate: string;
  invoiceNumber?: string;
}

export interface BirthdayOfferInput {
  customerPhone: string;
  customerName: string;
  discountPercent: number;
  validUntil: string;
}

/**
 * Send order confirmation SMS
 */
export async function sendOrderConfirmationSMS(
  input: OrderConfirmationSMSInput
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const message = `Hi ${input.customerName}, your order #${input.orderNumber} is confirmed. Total: ₹${input.totalAmount.toFixed(2)}.${input.estimatedDelivery ? ` Expected delivery: ${input.estimatedDelivery}` : ""} Thank you!`;

  const result = await sendSMS({
    to: normalizePhoneNumber(input.customerPhone),
    message,
  });

  return result;
}

/**
 * Send prescription refill reminder SMS
 */
export async function sendPrescriptionRefillReminder(
  input: PrescriptionRefillReminderInput
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const message = `Hi ${input.customerName}, it's time to refill your prescription #${input.prescriptionNumber} for ${input.medicineName}. Visit us in ${input.daysUntilRefill} days. Thank you!`;

  const result = await sendSMS({
    to: normalizePhoneNumber(input.customerPhone),
    message,
  });

  return result;
}

/**
 * Send stock arrival alert SMS
 */
export async function sendStockArrivalAlert(
  input: StockArrivalAlertInput
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const message = input.isAvailable
    ? `Hi ${input.customerName}, ${input.productName} is now available! Visit us to purchase. Thank you!`
    : `Hi ${input.customerName}, ${input.productName} is currently out of stock. We'll notify you when it's available. Thank you!`;

  const result = await sendSMS({
    to: normalizePhoneNumber(input.customerPhone),
    message,
  });

  return result;
}

/**
 * Send payment reminder SMS
 */
export async function sendPaymentReminder(
  input: PaymentReminderInput
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const invoiceText = input.invoiceNumber ? ` (Invoice: ${input.invoiceNumber})` : "";
  const message = `Hi ${input.customerName}, your payment of ₹${input.dueAmount.toFixed(2)} is due on ${input.dueDate}.${invoiceText} Please make payment at your earliest convenience. Thank you!`;

  const result = await sendSMS({
    to: normalizePhoneNumber(input.customerPhone),
    message,
  });

  return result;
}

/**
 * Send birthday offer SMS
 */
export async function sendBirthdayOffer(
  input: BirthdayOfferInput
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const message = `Happy Birthday ${input.customerName}! 🎉 Get ${input.discountPercent}% off on all medicines. Valid until ${input.validUntil}. Visit us to avail this offer. Thank you!`;

  const result = await sendSMS({
    to: normalizePhoneNumber(input.customerPhone),
    message,
  });

  return result;
}

/**
 * Send delivery update SMS
 */
export async function sendDeliveryUpdate(
  customerPhone: string,
  customerName: string,
  orderNumber: string,
  status: "dispatched" | "out_for_delivery" | "delivered",
  estimatedTime?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  let message = "";
  if (status === "dispatched") {
    message = `Hi ${customerName}, your order #${orderNumber} has been dispatched.`;
  } else if (status === "out_for_delivery") {
    message = `Hi ${customerName}, your order #${orderNumber} is out for delivery.${estimatedTime ? ` Expected delivery: ${estimatedTime}` : ""}`;
  } else if (status === "delivered") {
    message = `Hi ${customerName}, your order #${orderNumber} has been delivered. Thank you for shopping with us!`;
  }

  if (!message) {
    return { success: false, error: "Invalid delivery status" };
  }

  const result = await sendSMS({
    to: normalizePhoneNumber(customerPhone),
    message,
  });

  return result;
}
