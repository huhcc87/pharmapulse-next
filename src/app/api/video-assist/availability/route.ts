// GET /api/video-assist/availability
// Get availability status of support staff

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    
    // Require authentication
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Restrict to Pharmacist and Owner only
    const allowedRoles = ["PHARMACIST", "OWNER", "owner", "pharmacist"];
    const userRole = user.role.toUpperCase();
    
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { error: "Access denied. Video Assist is only available for Pharmacist and Owner accounts." },
        { status: 403 }
      );
    }

    // Get all users with support roles (OWNER, PHARMACIST, ADMIN)
    const supportStaff = await prisma.user.findMany({
      where: {
        role: {
          in: ["OWNER", "PHARMACIST", "ADMIN"],
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    // Check for active calls
    const activeCalls = await prisma.videoCallLog.findMany({
      where: {
        tenantId: DEMO_TENANT_ID,
        status: {
          in: ["RINGING", "CONNECTED"],
        },
      },
      select: {
        callId: true,
        participants: true,
      },
    });

    // Map active calls to user IDs
    const usersInCall = new Set<string>();
    activeCalls.forEach((call) => {
      const participants = call.participants as any;
      if (Array.isArray(participants)) {
        participants.forEach((p: any) => {
          if (p.status === "JOINED" || p.status === "INVITED") {
            usersInCall.add(p.userId);
          }
        });
      }
    });

    // Build availability status
    const availability = supportStaff.map((staff) => ({
      userId: String(staff.id),
      userName: staff.name,
      role: staff.role,
      isAvailable: !usersInCall.has(String(staff.id)),
      currentCallId: usersInCall.has(String(staff.id))
        ? activeCalls.find((call) => {
            const participants = call.participants as any;
            return Array.isArray(participants) &&
              participants.some((p: any) => p.userId === String(staff.id));
          })?.callId
        : undefined,
    }));

    return NextResponse.json(availability);
  } catch (error: any) {
    console.error("Get availability error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get availability" },
      { status: 500 }
    );
  }
}
