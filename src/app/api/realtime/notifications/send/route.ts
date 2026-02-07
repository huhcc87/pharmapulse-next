// POST /api/realtime/notifications/send
// Send a notification (for testing or server-side triggers)

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";

// In production, this would integrate with a message queue (Redis, RabbitMQ, etc.)
// For now, we'll use a simple in-memory store
const activeConnections = new Map<string, ReadableStreamDefaultController>();

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { type, title, message, data, targetUserId, targetTenantId } = body;

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: "type, title, and message are required" },
        { status: 400 }
      );
    }

    // In production, broadcast to all active SSE connections for the target user
    // For now, return success
    const notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type,
      title,
      message,
      data,
      timestamp: new Date().toISOString(),
      read: false,
    };

    // TODO: Broadcast to SSE connections
    // This would require maintaining a connection registry

    return NextResponse.json({
      success: true,
      notification,
    });
  } catch (error: any) {
    console.error("Send notification error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send notification" },
      { status: 500 }
    );
  }
}
