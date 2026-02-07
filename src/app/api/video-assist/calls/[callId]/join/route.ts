// POST /api/video-assist/calls/[callId]/join
// Join a video call (for receiver)

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
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

    if (callLog.status === "ENDED") {
      return NextResponse.json(
        { error: "Call has already ended" },
        { status: 400 }
      );
    }

    // Update participant status
    const participants = callLog.participants as any[];
    const updatedParticipants = participants.map((p) => {
      if (p.userId === user.userId || p.userId === String(user.userId)) {
        return { ...p, status: "JOINED" };
      }
      return p;
    });

    // Update call status
    const startedAt = callLog.startedAt || new Date();
    await prisma.videoCallLog.update({
      where: { callId },
      data: {
        status: "CONNECTED",
        participants: updatedParticipants,
        startedAt: callLog.startedAt || startedAt,
      },
    });

    return NextResponse.json({
      callId,
      status: "CONNECTED",
      provider: callLog.provider,
      meetingUrl: callLog.meetingUrl,
      meetingId: callLog.meetingId,
      roomName: callLog.roomName,
      participants: updatedParticipants,
    });
  } catch (error: any) {
    console.error("Join call error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to join call" },
      { status: 500 }
    );
  }
}
