// WhatsApp Order Placement API
// POST /api/whatsapp/orders/create
// Creates an order from WhatsApp message

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { sendWhatsAppMessage } from "@/lib/whatsapp/whatsapp-client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerPhone, customerName, items, notes, prescriptionId } = body;

    // Validate required fields
    if (!customerPhone || !customerName || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "customerPhone, customerName, and items (array) are required" },
        { status: 400 }
      );
    }

    // Normalize phone number
    const phone = customerPhone.replace(/[^\d+]/g, "");
    const normalizedPhone = phone.startsWith("+") ? phone : `+91${phone}`;

    // Validate items
    for (const item of items) {
      if (!item.productName || !item.quantity || item.quantity <= 0) {
        return NextResponse.json(
          { error: "Each item must have productName and quantity > 0" },
          { status: 400 }
        );
      }
    }

    // For now, create a draft invoice as order
    // In a full implementation, you might want a separate Order model
    const totalAmountPaise = items.reduce((sum: number, item: any) => {
      const itemTotal = (item.unitPricePaise || 0) * (item.quantity || 0);
      return sum + itemTotal;
    }, 0);

    // Create draft invoice (order)
    // Note: You'll need to adjust this based on your actual schema and tenant/branch context
    const order = await prisma.invoice.create({
      data: {
        tenantId: 1, // TODO: Get from session/auth
        sellerOrgId: 1, // TODO: Get from session/auth
        sellerGstinId: 1, // TODO: Get from session/auth
        buyerName: customerName,
        buyerPhone: normalizedPhone,
        invoiceType: "B2C",
        status: "DRAFT",
        totalInvoicePaise: totalAmountPaise,
        metadata: {
          source: "whatsapp",
          prescriptionId: prescriptionId || null,
          notes: notes || null,
        },
        lineItems: {
          create: items.map((item: any) => ({
            productName: item.productName,
            quantity: item.quantity,
            unitPricePaise: item.unitPricePaise || 0,
            taxablePaise: (item.unitPricePaise || 0) * item.quantity,
            lineTotalPaise: (item.unitPricePaise || 0) * item.quantity,
          })),
        },
      },
      include: {
        lineItems: true,
      },
    });

    // Send confirmation message
    const confirmationMessage = `✅ *Order Received!*\n\n` +
      `Hello ${customerName},\n\n` +
      `Your order has been received. We'll process it shortly.\n\n` +
      `*Order #${order.id}*\n` +
      `Total: ₹${(totalAmountPaise / 100).toFixed(2)}\n\n` +
      `You'll receive another message when your order is ready.\n\n` +
      `Thank you! 🏥\n` +
      `_PharmaPulse Pharmacy_`;

    const messageResult = await sendWhatsAppMessage({
      to: normalizedPhone,
      message: confirmationMessage,
    });

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        invoiceNumber: order.invoiceNumber,
        status: order.status,
        totalAmountPaise: order.totalInvoicePaise,
        items: order.lineItems.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPricePaise: item.unitPricePaise,
        })),
      },
      messageSent: messageResult.success,
      messageId: messageResult.messageId,
    });
  } catch (error: any) {
    console.error("WhatsApp order creation error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
