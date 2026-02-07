// Session Management Advanced API
// GET /api/security/sessions - List active sessions
// DELETE /api/security/sessions/[id] - Terminate session

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import {
  getActiveSessions,
  terminateSession,
  terminateAllUserSessions,
  getSessionActivitySummary,
  checkConcurrentSessionLimit,
} from "@/lib/security/session-management";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const userId = user.userId || user.email || "";
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type"); // list, summary, limit

    if (type === "summary") {
      const days = parseInt(searchParams.get("days") || "7");
      const summary = await getSessionActivitySummary(tenantId, userId, days);
      return NextResponse.json({ summary });
    } else if (type === "limit") {
      const maxSessions = parseInt(searchParams.get("maxSessions") || "5");
      const limit = await checkConcurrentSessionLimit(tenantId, userId, maxSessions);
      return NextResponse.json({ limit });
    } else {
      const sessions = await getActiveSessions(tenantId, userId);
      return NextResponse.json({ sessions });
    }
  } catch (error: any) {
    console.error("Get sessions API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/security/sessions - Terminate all sessions
// DELETE /api/security/sessions/[id] - Terminate specific session
export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const userId = user.userId || user.email || "";
    const searchParams = req.nextUrl.searchParams;
    const sessionId = searchParams.get("id");
    const reason = searchParams.get("reason");

    if (sessionId) {
      await terminateSession(tenantId, sessionId, reason || undefined);
      return NextResponse.json({
        success: true,
        message: "Session terminated",
      });
    } else {
      const count = await terminateAllUserSessions(tenantId, userId, reason || undefined);
      return NextResponse.json({
        success: true,
        message: `Terminated ${count} session(s)`,
        count,
      });
    }
  } catch (error: any) {
    console.error("Terminate session API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
