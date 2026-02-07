// SMS Client Library
// Supports multiple SMS providers: Twilio, AWS SNS, TextLocal, MSG91

export interface SMSMessage {
  to: string; // Phone number in E.164 format (+919876543210)
  message: string; // SMS message text
  templateId?: string; // Template ID for template-based SMS
  variables?: Record<string, string>; // Template variables
}

export interface SMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
}

/**
 * Send SMS message
 * 
 * Supports multiple providers:
 * - Twilio (default)
 * - AWS SNS
 * - TextLocal
 * - MSG91
 */
export async function sendSMS(message: SMSMessage): Promise<SMSResponse> {
  const provider = process.env.SMS_PROVIDER || "twilio";

  try {
    switch (provider.toLowerCase()) {
      case "twilio":
        return await sendViaTwilio(message);
      case "aws":
      case "sns":
        return await sendViaAWS(message);
      case "textlocal":
        return await sendViaTextLocal(message);
      case "msg91":
        return await sendViaMSG91(message);
      default:
        return await sendViaTwilio(message);
    }
  } catch (error: any) {
    console.error("SMS sending error:", error);
    return {
      success: false,
      error: error.message || "SMS sending failed",
    };
  }
}

/**
 * Send SMS via Twilio
 */
async function sendViaTwilio(message: SMSMessage): Promise<SMSResponse> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    // Mock for development
    console.warn("Twilio credentials not configured. Returning mock SMS response.");
    return {
      success: true,
      messageId: `mock-${Date.now()}`,
      provider: "twilio",
    };
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: message.to,
          Body: message.message,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || "Twilio SMS failed",
        provider: "twilio",
      };
    }

    return {
      success: true,
      messageId: data.sid,
      provider: "twilio",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Twilio SMS error",
      provider: "twilio",
    };
  }
}

/**
 * Send SMS via AWS SNS
 */
async function sendViaAWS(message: SMSMessage): Promise<SMSResponse> {
  // AWS SNS implementation
  // Requires AWS SDK and credentials
  console.warn("AWS SNS SMS not yet implemented. Use Twilio or TextLocal.");
  return {
    success: false,
    error: "AWS SNS SMS not yet implemented",
    provider: "aws",
  };
}

/**
 * Send SMS via TextLocal
 */
async function sendViaTextLocal(message: SMSMessage): Promise<SMSResponse> {
  const apiKey = process.env.TEXTLOCAL_API_KEY;
  const sender = process.env.TEXTLOCAL_SENDER || "TXTLCL";

  if (!apiKey) {
    console.warn("TextLocal API key not configured. Returning mock SMS response.");
    return {
      success: true,
      messageId: `mock-${Date.now()}`,
      provider: "textlocal",
    };
  }

  try {
    const response = await fetch("https://api.textlocal.in/send/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apikey: apiKey,
        numbers: message.to.replace("+", ""), // Remove + for TextLocal
        message: message.message,
        sender: sender,
      }),
    });

    const data = await response.json();

    if (data.status !== "success") {
      return {
        success: false,
        error: data.errors?.[0]?.message || "TextLocal SMS failed",
        provider: "textlocal",
      };
    }

    return {
      success: true,
      messageId: data.batch_id?.toString() || `textlocal-${Date.now()}`,
      provider: "textlocal",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "TextLocal SMS error",
      provider: "textlocal",
    };
  }
}

/**
 * Send SMS via MSG91
 */
async function sendViaMSG91(message: SMSMessage): Promise<SMSResponse> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const sender = process.env.MSG91_SENDER || "PHARMA";

  if (!authKey) {
    console.warn("MSG91 auth key not configured. Returning mock SMS response.");
    return {
      success: true,
      messageId: `mock-${Date.now()}`,
      provider: "msg91",
    };
  }

  try {
    const response = await fetch("https://api.msg91.com/api/v2/sendsms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify({
        sender: sender,
        route: "4", // Transactional route
        country: "91", // India
        sms: [
          {
            message: message.message,
            to: [message.to.replace("+", "")], // Remove + for MSG91
          },
        ],
      }),
    });

    const data = await response.json();

    if (data.type !== "success") {
      return {
        success: false,
        error: data.message || "MSG91 SMS failed",
        provider: "msg91",
      };
    }

    return {
      success: true,
      messageId: data.request_id || `msg91-${Date.now()}`,
      provider: "msg91",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "MSG91 SMS error",
      provider: "msg91",
    };
  }
}

/**
 * Normalize phone number to E.164 format
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");

  // If starts with 0, remove it
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  // If doesn't start with country code, add India (+91)
  if (!cleaned.startsWith("91") && cleaned.length === 10) {
    cleaned = "91" + cleaned;
  }

  // Add + prefix
  return "+" + cleaned;
}
