// SMS Send API
// POST /api/sms/send - Send SMS notification

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { sendSMS, normalizePhoneNumber } from "@/lib/sms/sms-client";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { to, message, templateId, variables } = body;

    if (!to) {
      return NextResponse.json(
        { error: "Phone number (to) is required" },
        { status: 400 }
      );
    }

    if (!message && !templateId) {
      return NextResponse.json(
        { error: "Message or templateId is required" },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(to);

    // Send SMS
    const result = await sendSMS({
      to: normalizedPhone,
      message: message || "",
      templateId,
      variables,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "SMS sending failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      provider: result.provider,
    });
  } catch (error: any) {
    console.error("SMS API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
