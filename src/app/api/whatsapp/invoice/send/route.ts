// Send Invoice via WhatsApp
// POST /api/whatsapp/invoice/send

import { NextRequest, NextResponse } from "next/server";
import { sendInvoiceViaWhatsApp } from "@/lib/whatsapp/whatsapp-client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { invoiceId, customerPhone } = body;

    if (!invoiceId || !customerPhone) {
      return NextResponse.json(
        { error: "invoiceId and customerPhone are required" },
        { status: 400 }
      );
    }

    // Normalize phone number
    const phone = customerPhone.replace(/[^\d+]/g, "");
    const normalizedPhone = phone.startsWith("+") ? phone : `+91${phone}`;

    // Send invoice via WhatsApp
    const result = await sendInvoiceViaWhatsApp(invoiceId, normalizedPhone);

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error || "Failed to send invoice via WhatsApp",
          errorCode: result.errorCode,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: "Invoice sent successfully via WhatsApp",
    });
  } catch (error: any) {
    console.error("Send invoice via WhatsApp API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
