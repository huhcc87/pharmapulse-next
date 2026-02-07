// POST /api/video-assist/calls/[callId]/end
// End a video call

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
    const body = await req.json();
    const { notes } = body;

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
      return NextResponse.json({ message: "Call already ended" });
    }

    // Calculate duration
    const endedAt = new Date();
    let duration = callLog.duration;
    if (callLog.startedAt) {
      duration = Math.floor((endedAt.getTime() - callLog.startedAt.getTime()) / 1000);
    }

    // Update call log
    await prisma.videoCallLog.update({
      where: { callId },
      data: {
        status: "ENDED",
        endedAt,
        duration,
        postCallNotes: notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Call ended",
      duration,
    });
  } catch (error: any) {
    console.error("End call error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to end call" },
      { status: 500 }
    );
  }
}
