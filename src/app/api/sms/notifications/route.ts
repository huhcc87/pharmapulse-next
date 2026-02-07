// SMS Notifications API
// POST /api/sms/notifications - Send pre-built SMS notifications

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import {
  sendOrderConfirmationSMS,
  sendPrescriptionRefillReminder,
  sendStockArrivalAlert,
  sendPaymentReminder,
  sendBirthdayOffer,
  sendDeliveryUpdate,
} from "@/lib/sms/notifications";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { type, ...data } = body;

    if (!type) {
      return NextResponse.json(
        { error: "Notification type is required" },
        { status: 400 }
      );
    }

    let result;

    switch (type) {
      case "order_confirmation":
        result = await sendOrderConfirmationSMS(data);
        break;

      case "prescription_refill":
        result = await sendPrescriptionRefillReminder(data);
        break;

      case "stock_arrival":
        result = await sendStockArrivalAlert(data);
        break;

      case "payment_reminder":
        result = await sendPaymentReminder(data);
        break;

      case "birthday_offer":
        result = await sendBirthdayOffer(data);
        break;

      case "delivery_update":
        result = await sendDeliveryUpdate(
          data.customerPhone,
          data.customerName,
          data.orderNumber,
          data.status,
          data.estimatedTime
        );
        break;

      default:
        return NextResponse.json(
          { error: `Unknown notification type: ${type}` },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "SMS notification failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (error: any) {
    console.error("SMS notifications API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
