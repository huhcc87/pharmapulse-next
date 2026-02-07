// GET /api/video-assist/calls/history
// Get video call history

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    const calls = await prisma.videoCallLog.findMany({
      where: {
        tenantId: DEMO_TENANT_ID,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      select: {
        id: true,
        callId: true,
        context: true,
        participants: true,
        status: true,
        duration: true,
        createdAt: true,
        startedAt: true,
        endedAt: true,
        reason: true,
      },
    });

    // Get user names for participants
    const userIds = new Set<string>();
    calls.forEach((call) => {
      const participants = call.participants as any;
      if (Array.isArray(participants)) {
        participants.forEach((p: any) => {
          userIds.add(p.userId);
        });
      }
    });

    const users = await prisma.user.findMany({
      where: {
        id: {
          in: Array.from(userIds).map((id) => parseInt(id)).filter((id) => !isNaN(id)),
        },
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
    });

    const userMap = new Map(users.map((u) => [String(u.id), u]));

    const history = calls.map((call) => {
      const participants = (call.participants as any) || [];
      const participantNames = participants.map((p: any) => {
        const user = userMap.get(p.userId);
        return {
          userName: user?.name || "Unknown",
          role: p.role || user?.role || "STAFF",
        };
      });

      return {
        id: call.id,
        callId: call.callId,
        context: call.context,
        participants: participantNames,
        status: call.status,
        duration: call.duration,
        createdAt: call.createdAt,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        reason: call.reason,
      };
    });

    return NextResponse.json(history);
  } catch (error: any) {
    console.error("Get call history error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get call history" },
      { status: 500 }
    );
  }
}
