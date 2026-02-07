// WhatsApp Business API Client
// Supports WhatsApp Business Cloud API (Meta) and Twilio

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface WhatsAppMessage {
  to: string; // Phone number in E.164 format (e.g., +919876543210)
  message: string;
  mediaUrl?: string; // Optional media (image, PDF, etc.)
  mediaType?: "image" | "document" | "video";
}

export interface WhatsAppOrder {
  customerPhone: string;
  customerName: string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPricePaise: number;
  }>;
  notes?: string;
  prescriptionId?: number;
}

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Send WhatsApp message
 * 
 * Supports:
 * - Meta WhatsApp Business Cloud API
 * - Twilio WhatsApp API
 * 
 * Environment variables:
 * - WHATSAPP_PROVIDER: "meta" | "twilio" (default: "meta")
 * - WHATSAPP_API_TOKEN: API token/access token
 * - WHATSAPP_PHONE_NUMBER_ID: Phone number ID (Meta) or WhatsApp number (Twilio)
 * - WHATSAPP_VERIFY_TOKEN: Webhook verification token (Meta)
 * - TWILIO_ACCOUNT_SID: Twilio Account SID
 * - TWILIO_AUTH_TOKEN: Twilio Auth Token
 * - TWILIO_WHATSAPP_NUMBER: Twilio WhatsApp number (format: whatsapp:+14155238886)
 */
export async function sendWhatsAppMessage(
  message: WhatsAppMessage
): Promise<WhatsAppResponse> {
  const provider = process.env.WHATSAPP_PROVIDER || "meta";

  if (provider === "meta") {
    return sendViaMeta(message);
  } else if (provider === "twilio") {
    return sendViaTwilio(message);
  } else {
    return {
      success: false,
      error: `Unsupported WhatsApp provider: ${provider}`,
      errorCode: "UNSUPPORTED_PROVIDER",
    };
  }
}

/**
 * Send via Meta WhatsApp Business Cloud API
 */
async function sendViaMeta(message: WhatsAppMessage): Promise<WhatsAppResponse> {
  const API_TOKEN = process.env.WHATSAPP_API_TOKEN;
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const API_BASE = process.env.WHATSAPP_API_BASE || "https://graph.facebook.com/v18.0";

  if (!API_TOKEN || !PHONE_NUMBER_ID) {
    console.warn("WhatsApp Meta credentials not configured. Returning mock response.");
    return {
      success: true,
      messageId: `MOCK-MSG-${Date.now()}`,
    };
  }

  try {
    // Normalize phone number (remove +, spaces, ensure starts with country code)
    const to = normalizePhoneNumber(message.to);

    // Build payload
    const payload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: message.mediaUrl ? "template" : "text",
    };

    if (message.mediaUrl) {
      payload.type = message.mediaType === "image" ? "image" : 
                     message.mediaType === "document" ? "document" :
                     message.mediaType === "video" ? "video" : "document";
      payload[payload.type] = {
        link: message.mediaUrl,
        caption: message.message,
      };
    } else {
      payload.text = {
        preview_url: false,
        body: message.message,
      };
    }

    // Send message
    const response = await fetch(`${API_BASE}/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error?.message || "WhatsApp message sending failed",
        errorCode: errorData.error?.code?.toString() || "API_ERROR",
      };
    }

    const data = await response.json();

    // Log message
    await logWhatsAppMessage({
      to: message.to,
      message: message.message,
      messageId: data.messages?.[0]?.id || `MSG-${Date.now()}`,
      provider: "meta",
      status: "sent",
    });

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error: any) {
    console.error("WhatsApp Meta API error:", error);
    return {
      success: false,
      error: error.message || "Unknown error occurred",
      errorCode: "API_ERROR",
    };
  }
}

/**
 * Send via Twilio WhatsApp API
 */
async function sendViaTwilio(message: WhatsAppMessage): Promise<WhatsAppResponse> {
  const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const FROM_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

  if (!ACCOUNT_SID || !AUTH_TOKEN) {
    console.warn("Twilio credentials not configured. Returning mock response.");
    return {
      success: true,
      messageId: `MOCK-MSG-${Date.now()}`,
    };
  }

  try {
    const to = normalizePhoneNumber(message.to);
    const toWhatsApp = `whatsapp:${to}`;

    // Build Twilio API URL
    const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;

    // Build form data
    const formData = new URLSearchParams();
    formData.append("From", FROM_NUMBER);
    formData.append("To", toWhatsApp);
    formData.append("Body", message.message);

    if (message.mediaUrl) {
      formData.append("MediaUrl", message.mediaUrl);
    }

    // Send message
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64")}`,
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || "WhatsApp message sending failed",
        errorCode: errorData.code?.toString() || "API_ERROR",
      };
    }

    const data = await response.json();

    // Log message
    await logWhatsAppMessage({
      to: message.to,
      message: message.message,
      messageId: data.sid,
      provider: "twilio",
      status: "sent",
    });

    return {
      success: true,
      messageId: data.sid,
    };
  } catch (error: any) {
    console.error("Twilio WhatsApp API error:", error);
    return {
      success: false,
      error: error.message || "Unknown error occurred",
      errorCode: "API_ERROR",
    };
  }
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, "");

  // If doesn't start with +, assume India (+91)
  if (!normalized.startsWith("+")) {
    if (normalized.startsWith("91") && normalized.length === 12) {
      normalized = `+${normalized}`;
    } else if (normalized.length === 10) {
      normalized = `+91${normalized}`;
    } else {
      normalized = `+${normalized}`;
    }
  }

  return normalized;
}

/**
 * Log WhatsApp message to database (for tracking)
 */
async function logWhatsAppMessage(data: {
  to: string;
  message: string;
  messageId: string;
  provider: string;
  status: string;
}) {
  try {
    // Create a WhatsAppMessage log entry if model exists
    // For now, just log to console
    console.log("WhatsApp message logged:", {
      to: data.to,
      messageId: data.messageId,
      provider: data.provider,
      status: data.status,
      timestamp: new Date(),
    });
  } catch (error) {
    // Ignore logging errors
    console.warn("Failed to log WhatsApp message:", error);
  }
}

/**
 * Send order confirmation via WhatsApp
 */
export async function sendOrderConfirmation(
  orderId: number,
  customerPhone: string
): Promise<WhatsAppResponse> {
  try {
    // Fetch order details
    // Note: Assuming you have an Order model, adjust as needed
    // For now, using invoice as order
    const invoice = await prisma.invoice.findUnique({
      where: { id: orderId },
      include: {
        lineItems: true,
        customer: true,
      },
    });

    if (!invoice) {
      return {
        success: false,
        error: "Order not found",
        errorCode: "ORDER_NOT_FOUND",
      };
    }

    const customerName = invoice.customer?.name || invoice.buyerName || "Customer";
    const totalAmount = (invoice.totalInvoicePaise / 100).toFixed(2);

    // Build message
    let message = `🎉 *Order Confirmed!*\n\n`;
    message += `Hello ${customerName},\n\n`;
    message += `Your order #${invoice.invoiceNumber} has been confirmed.\n\n`;
    message += `*Items:*\n`;

    invoice.lineItems.forEach((item, idx) => {
      const price = (item.lineTotalPaise / 100).toFixed(2);
      message += `${idx + 1}. ${item.productName} x${item.quantity} - ₹${price}\n`;
    });

    message += `\n*Total Amount: ₹${totalAmount}*\n`;
    message += `\nThank you for your order! 🏥\n`;
    message += `\n_PharmaPulse Pharmacy_`;

    return await sendWhatsAppMessage({
      to: customerPhone,
      message: message,
    });
  } catch (error: any) {
    console.error("Send order confirmation error:", error);
    return {
      success: false,
      error: error.message || "Unknown error occurred",
      errorCode: "API_ERROR",
    };
  }
}

/**
 * Send invoice via WhatsApp
 */
export async function sendInvoiceViaWhatsApp(
  invoiceId: number,
  customerPhone: string
): Promise<WhatsAppResponse> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lineItems: true,
        customer: true,
      },
    });

    if (!invoice) {
      return {
        success: false,
        error: "Invoice not found",
        errorCode: "INVOICE_NOT_FOUND",
      };
    }

    const customerName = invoice.customer?.name || invoice.buyerName || "Customer";
    const totalAmount = (invoice.totalInvoicePaise / 100).toFixed(2);
    const invoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/invoices/${invoiceId}/print`;

    // Build message
    let message = `📄 *Invoice #${invoice.invoiceNumber}*\n\n`;
    message += `Hello ${customerName},\n\n`;
    message += `Your invoice is ready.\n\n`;
    message += `*Invoice Details:*\n`;
    message += `Date: ${new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}\n`;
    message += `Total: ₹${totalAmount}\n`;
    message += `Payment Status: ${invoice.paymentStatus}\n`;

    if (invoice.eInvoiceIrn) {
      message += `\n*E-Invoice IRN:* ${invoice.eInvoiceIrn}\n`;
    }

    if (invoice.eWayBillNumber) {
      message += `*E-Way Bill:* ${invoice.eWayBillNumber}\n`;
    }

    message += `\n📎 View Invoice: ${invoiceUrl}\n`;
    message += `\nThank you! 🏥\n`;
    message += `_PharmaPulse Pharmacy_`;

    // Send as text message, optionally include PDF link
    return await sendWhatsAppMessage({
      to: customerPhone,
      message: message,
      // Optionally include PDF URL as media
      // mediaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/invoices/${invoiceId}/pdf`,
      // mediaType: "document",
    });
  } catch (error: any) {
    console.error("Send invoice via WhatsApp error:", error);
    return {
      success: false,
      error: error.message || "Unknown error occurred",
      errorCode: "API_ERROR",
    };
  }
}
