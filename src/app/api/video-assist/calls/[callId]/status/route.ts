// GET /api/video-assist/calls/[callId]/status
// Get video call status

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    // Restrict to Pharmacist and Owner only
    const allowedRoles = ["PHARMACIST", "OWNER", "owner", "pharmacist"];
    const userRole = user.role.toUpperCase();
    
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { error: "Access denied. Video Assist is only available for Pharmacist and Owner accounts." },
        { status: 403 }
      );
    }

    const { callId } = await params;

    const callLog = await prisma.videoCallLog.findUnique({
      where: { callId },
    });

    if (!callLog) {
      return NextResponse.json(
        { error: "Call not found" },
        { status: 404 }
      );
    }

    // Calculate duration if call is active
    let duration = callLog.duration;
    if (callLog.status === "CONNECTED" && callLog.startedAt) {
      duration = Math.floor(
        (Date.now() - callLog.startedAt.getTime()) / 1000
      );
    }

    return NextResponse.json({
      callId: callLog.callId,
      status: callLog.status,
      provider: callLog.provider,
      meetingUrl: callLog.meetingUrl,
      meetingId: callLog.meetingId,
      roomName: callLog.roomName,
      participants: callLog.participants as any,
      context: callLog.context,
      contextData: callLog.contextData,
      startedAt: callLog.startedAt,
      endedAt: callLog.endedAt,
      duration,
    });
  } catch (error: any) {
    console.error("Get call status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get call status" },
      { status: 500 }
    );
  }
}
