// GET /api/realtime/notifications
// Server-Sent Events (SSE) endpoint for real-time notifications

import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || user.userId || "1";
    const tenantId = parseInt(searchParams.get("tenantId") || "1");

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "CONNECTED", message: "Connected to notification stream" })}\n\n`));

        // Keep connection alive with heartbeat
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          } catch (error) {
            clearInterval(heartbeat);
          }
        }, 30000); // Every 30 seconds

        // Cleanup on close
        req.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
    });
  } catch (error: any) {
    console.error("SSE error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
