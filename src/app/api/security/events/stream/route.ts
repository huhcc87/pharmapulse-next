// Security Event Streaming API
// GET /api/security/events/stream - Stream security events
// GET /api/security/events/filter - Filter security events

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { getSecurityEvents, correlateSecurityEvents } from "@/lib/security/event-streaming";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type"); // stream, filter, correlate

    if (type === "correlate") {
      const correlationId = searchParams.get("correlationId");
      if (!correlationId) {
        return NextResponse.json(
          { error: "correlationId is required" },
          { status: 400 }
        );
      }

      const correlation = await correlateSecurityEvents(tenantId, correlationId);
      return NextResponse.json({ correlation });
    }

    // Filter events
    const filter: any = {};
    if (searchParams.get("eventType")) {
      filter.eventType = searchParams.get("eventType");
    }
    if (searchParams.get("severity")) {
      filter.severity = searchParams.get("severity") as any;
    }
    if (searchParams.get("userId")) {
      filter.userId = searchParams.get("userId");
    }
    if (searchParams.get("ipAddress")) {
      filter.ipAddress = searchParams.get("ipAddress");
    }
    if (searchParams.get("startDate")) {
      filter.startDate = new Date(searchParams.get("startDate")!);
    }
    if (searchParams.get("endDate")) {
      filter.endDate = new Date(searchParams.get("endDate")!);
    }
    if (searchParams.get("limit")) {
      filter.limit = parseInt(searchParams.get("limit")!);
    }

    const events = await getSecurityEvents(tenantId, filter);

    // For streaming, return Server-Sent Events format
    if (type === "stream") {
      const stream = new ReadableStream({
        start(controller) {
          // Send initial events
          const encoder = new TextEncoder();
          for (const event of events) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
          }
          // In a real implementation, this would keep the stream open
          // and send new events as they occur
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Regular JSON response
    return NextResponse.json({
      events,
    });
  } catch (error: any) {
    console.error("Security events stream API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
