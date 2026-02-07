// WhatsApp Webhook Handler
// GET /api/whatsapp/webhook - Verification
// POST /api/whatsapp/webhook - Receive messages

import { NextRequest, NextResponse } from "next/server";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "pharmapulse-verify-token";

/**
 * GET - Webhook verification (for Meta WhatsApp)
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Verify webhook
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("WhatsApp webhook verified");
    return NextResponse.json(parseInt(challenge || "0"), { status: 200 });
  } else {
    console.error("WhatsApp webhook verification failed");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

/**
 * POST - Receive WhatsApp messages
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Handle Meta WhatsApp webhook
    if (body.object === "whatsapp_business_account") {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages || [];
      const statuses = value?.statuses || [];

      // Process incoming messages
      for (const message of messages) {
        await handleIncomingMessage(message, value);
      }

      // Process status updates (delivered, read, etc.)
      for (const status of statuses) {
        await handleStatusUpdate(status);
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Handle Twilio webhook
    if (body.MessageSid) {
      await handleTwilioMessage(body);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Unknown format
    console.warn("Unknown webhook format:", JSON.stringify(body, null, 2));
    return NextResponse.json({ error: "Unknown webhook format" }, { status: 400 });
  } catch (error: any) {
    console.error("WhatsApp webhook error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Handle incoming WhatsApp message
 */
async function handleIncomingMessage(message: any, value: any) {
  try {
    const from = message.from;
    const messageType = message.type;
    const messageId = message.id;
    const timestamp = message.timestamp;

    let messageText = "";
    let mediaUrl = "";

    if (messageType === "text") {
      messageText = message.text?.body || "";
    } else if (messageType === "image") {
      messageText = message.image?.caption || "";
      mediaUrl = message.image?.url || "";
    } else if (messageType === "document") {
      messageText = message.document?.caption || "";
      mediaUrl = message.document?.url || "";
    } else if (messageType === "audio") {
      mediaUrl = message.audio?.url || "";
      messageText = "[Audio message]";
    }

    console.log("Received WhatsApp message:", {
      from,
      messageId,
      type: messageType,
      text: messageText,
      timestamp: new Date(timestamp * 1000),
    });

    // Process order-related messages
    if (messageText.toLowerCase().includes("order") || 
        messageText.toLowerCase().includes("medicine") ||
        messageText.toLowerCase().includes("prescription")) {
      await handleOrderMessage(from, messageText, mediaUrl);
    }

    // Store message in database (if you have a WhatsAppMessage model)
    // await prisma.whatsAppMessage.create({ ... });

  } catch (error) {
    console.error("Error handling incoming message:", error);
  }
}

/**
 * Handle order-related messages
 */
async function handleOrderMessage(phone: string, text: string, mediaUrl: string) {
  try {
    // Simple order parsing (in production, use NLP or structured templates)
    const orderMatch = text.match(/order\s+(.+)/i);
    
    if (orderMatch || mediaUrl) {
      // Extract order details from text or process prescription image
      console.log("Processing order from WhatsApp:", { phone, text, mediaUrl });
      
      // In production, implement:
      // 1. Parse prescription image (OCR)
      // 2. Extract drug names and quantities
      // 3. Create order/invoice
      // 4. Send confirmation
    }
  } catch (error) {
    console.error("Error processing order message:", error);
  }
}

/**
 * Handle message status updates
 */
async function handleStatusUpdate(status: any) {
  try {
    const messageId = status.id;
    const statusType = status.status; // sent, delivered, read, failed
    const timestamp = status.timestamp;

    console.log("WhatsApp message status:", {
      messageId,
      status: statusType,
      timestamp: new Date(timestamp * 1000),
    });

    // Update message status in database (if you have a WhatsAppMessage model)
    // await prisma.whatsAppMessage.update({ ... });

  } catch (error) {
    console.error("Error handling status update:", error);
  }
}

/**
 * Handle Twilio webhook format
 */
async function handleTwilioMessage(body: any) {
  try {
    const from = body.From?.replace("whatsapp:", "");
    const to = body.To?.replace("whatsapp:", "");
    const messageText = body.Body || "";
    const messageSid = body.MessageSid;

    console.log("Received Twilio WhatsApp message:", {
      from,
      to,
      messageId: messageSid,
      text: messageText,
    });

    // Process similar to Meta messages
    if (messageText.toLowerCase().includes("order") || 
        messageText.toLowerCase().includes("medicine")) {
      await handleOrderMessage(from, messageText, "");
    }
  } catch (error) {
    console.error("Error handling Twilio message:", error);
  }
}
