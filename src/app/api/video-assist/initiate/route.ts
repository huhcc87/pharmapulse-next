// POST /api/video-assist/initiate
// Initiate a context-aware video call

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { VideoCallRequest, VideoCallResponse } from "@/lib/video-assist/types";
// Using cuid for ID generation (Prisma default)

const DEMO_TENANT_ID = 1;

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    
    // Require authentication
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required. Please log in." },
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

    const body: VideoCallRequest = await req.json();
    const { context, contextData, requestedBy, requestedRole, targetRole, tenantId } = body;

    // Find available staff based on role routing
    // Priority: owner -> pharmacist -> any available staff
    const rolePriority = targetRole ? [targetRole.toUpperCase()] : ["OWNER", "PHARMACIST", "ADMIN"];
    
    let availableStaff = null;
    for (const roleUpper of rolePriority) {
      const staff = await prisma.user.findFirst({
        where: {
          OR: [
            { role: roleUpper },
            { role: roleUpper.toLowerCase() },
            { role: roleUpper.charAt(0) + roleUpper.slice(1).toLowerCase() },
          ],
          // In production, check availability status from a separate table
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });
      if (staff) {
        availableStaff = staff;
        break;
      }
    }

    if (!availableStaff) {
      return NextResponse.json(
        { error: "No staff available for video call" },
        { status: 503 }
      );
    }

    // Generate call ID
    const callId = `CALL-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    // Get requester user details
    const requesterUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: parseInt(requestedBy) || undefined },
          { email: requestedBy },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    // Determine provider (default to WebRTC, can be configured)
    const provider = (process.env.VIDEO_CALL_PROVIDER as any) || "WEBRTC";
    
    // Generate meeting URL based on provider
    let meetingUrl: string | undefined;
    let meetingId: string | undefined;
    let accessToken: string | undefined;
    let roomName: string | undefined;

    if (provider === "TWILIO" && process.env.TWILIO_ACCOUNT_SID) {
      // Twilio Video Rooms
      meetingId = `room-${callId}`;
      meetingUrl = `https://video.twilio.com/v1/Rooms/${meetingId}`;
      // In production, generate Twilio access token
    } else if (provider === "AGORA" && process.env.AGORA_APP_ID) {
      // Agora
      roomName = callId;
      meetingUrl = `agora://${roomName}`;
      // In production, generate Agora token
    } else {
      // WebRTC (default) - use simple peer-to-peer
      meetingId = callId;
      meetingUrl = `/video-call/${callId}`;
    }

    // Create call log with user details
    await prisma.videoCallLog.create({
      data: {
        callId,
        tenantId: tenantId || DEMO_TENANT_ID,
        context,
        contextData: contextData ? JSON.parse(JSON.stringify(contextData)) : null,
        requestedBy,
        requestedRole: requestedRole || requesterUser?.role || null,
        targetRole: targetRole || null,
        provider,
        meetingUrl,
        meetingId,
        roomName,
        status: "RINGING",
        participants: [
          { 
            userId: requestedBy, 
            role: requestedRole || requesterUser?.role || "STAFF", 
            status: "INVITED",
            userName: requesterUser?.name || undefined,
          },
          { 
            userId: String(availableStaff.id), 
            role: availableStaff.role, 
            status: "INVITED",
            userName: availableStaff.name || undefined,
          },
        ],
      },
    });

    // Send notification to available staff (in production, use WebSocket/SSE)
    // For now, return response immediately

    const response: VideoCallResponse = {
      callId,
      status: "RINGING",
      provider,
      meetingUrl,
      meetingId,
      accessToken,
      roomName,
      participants: [
        { 
          userId: requestedBy, 
          role: requestedRole || requesterUser?.role || "STAFF", 
          status: "INVITED",
          userName: requesterUser?.name || "You",
          email: requesterUser?.email || undefined,
        },
        { 
          userId: String(availableStaff.id), 
          role: availableStaff.role, 
          status: "INVITED",
          userName: availableStaff.name || "Staff",
          email: availableStaff.email || undefined,
        },
      ],
      context,
      contextData,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Video assist initiate error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initiate video call" },
      { status: 500 }
    );
  }
}
