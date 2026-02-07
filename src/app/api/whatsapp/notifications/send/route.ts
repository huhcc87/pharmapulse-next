// Send WhatsApp Notification
// POST /api/whatsapp/notifications/send
// Generic endpoint for sending notifications (order confirmations, refills, stock alerts, etc.)

import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage, sendOrderConfirmation } from "@/lib/whatsapp/whatsapp-client";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, customerPhone, data } = body;

    if (!type || !customerPhone) {
      return NextResponse.json(
        { error: "type and customerPhone are required" },
        { status: 400 }
      );
    }

    // Normalize phone number
    const phone = customerPhone.replace(/[^\d+]/g, "");
    const normalizedPhone = phone.startsWith("+") ? phone : `+91${phone}`;

    let message = "";
    let result;

    switch (type) {
      case "order_confirmation":
        if (!data?.orderId) {
          return NextResponse.json(
            { error: "orderId is required for order_confirmation" },
            { status: 400 }
          );
        }
        result = await sendOrderConfirmation(data.orderId, normalizedPhone);
        break;

      case "prescription_refill":
        message = `💊 *Prescription Refill Reminder*\n\n` +
          `Hello ${data.customerName || "Customer"},\n\n` +
          `This is a reminder that your prescription for *${data.medicineName || "medication"}* is due for a refill.\n\n` +
          `Please visit us or order via WhatsApp.\n\n` +
          `Thank you! 🏥\n` +
          `_PharmaPulse Pharmacy_`;
        result = await sendWhatsAppMessage({ to: normalizedPhone, message });
        break;

      case "stock_arrival":
        message = `📦 *Stock Arrival Notification*\n\n` +
          `Hello ${data.customerName || "Customer"},\n\n` +
          `Great news! The medicine you were looking for is now available:\n\n` +
          `*${data.productName}*\n\n` +
          `Visit us or order via WhatsApp to get it.\n\n` +
          `Thank you! 🏥\n` +
          `_PharmaPulse Pharmacy_`;
        result = await sendWhatsAppMessage({ to: normalizedPhone, message });
        break;

      case "birthday_offer":
        message = `🎉 *Happy Birthday!*\n\n` +
          `Hello ${data.customerName || "Customer"},\n\n` +
          `Wishing you a very happy birthday! 🎂\n\n` +
          `As a special gift, enjoy *${data.discountPercent || 10}% off* on your next purchase.\n\n` +
          `Valid until ${data.validUntil || "end of month"}.\n\n` +
          `Visit us or order via WhatsApp.\n\n` +
          `Thank you! 🏥\n` +
          `_PharmaPulse Pharmacy_`;
        result = await sendWhatsAppMessage({ to: normalizedPhone, message });
        break;

      case "payment_reminder":
        message = `💳 *Payment Reminder*\n\n` +
          `Hello ${data.customerName || "Customer"},\n\n` +
          `This is a friendly reminder about your pending payment.\n\n` +
          `*Invoice #${data.invoiceNumber}*\n` +
          `Amount Due: ₹${(data.amountPaise / 100).toFixed(2)}\n` +
          `Due Date: ${data.dueDate || "ASAP"}\n\n` +
          `Please clear your dues at your earliest convenience.\n\n` +
          `Thank you! 🏥\n` +
          `_PharmaPulse Pharmacy_`;
        result = await sendWhatsAppMessage({ to: normalizedPhone, message });
        break;

      case "custom":
        if (!data?.message) {
          return NextResponse.json(
            { error: "message is required for custom notification" },
            { status: 400 }
          );
        }
        result = await sendWhatsAppMessage({ to: normalizedPhone, message: data.message });
        break;

      default:
        return NextResponse.json(
          { error: `Unknown notification type: ${type}` },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error || "Failed to send notification",
          errorCode: result.errorCode,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: "Notification sent successfully via WhatsApp",
    });
  } catch (error: any) {
    console.error("Send WhatsApp notification API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
