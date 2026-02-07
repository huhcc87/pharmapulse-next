/**
 * IP Address Management API
 * 
 * Endpoints:
 * - GET: Get current allowed IP
 * - POST: Set or request IP change (with guardrails)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { extractClientIP, normalizeIP } from "@/lib/licensing/ip-extraction";
import { z } from "zod";

const setIpSchema = z.object({
  action: z.enum(["set", "request"]),
  ip: z.string().optional(), // If not provided, use current IP
  reason: z.string().min(10, "Reason must be at least 10 characters").optional(), // Required for requests
});

// GET /api/licensing/ip - Get current IP settings
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(
        { 
          error: "UNAUTHORIZED",
          message: "Authentication required. Please ensure you are logged in.",
          help: "In development, cookies are auto-set. If this persists, check browser console."
        },
        { status: 401 }
      );
    }
    
    requireAuth(user);

    const license = await prisma.license.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!license) {
      return NextResponse.json(
        { error: "License not found" },
        { status: 404 }
      );
    }

    const currentIP = extractClientIP(request);
    const activeDevice = await prisma.deviceRegistration.findFirst({
      where: {
        tenantId: user.tenantId,
        revokedAt: null,
      },
    });

    // Check for pending IP change requests
    const pendingRequest = await prisma.ipChangeRequest.findFirst({
      where: {
        tenantId: user.tenantId,
        status: "pending",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Check last IP change (for cooldown)
    const lastApprovedRequest = await prisma.ipChangeRequest.findFirst({
      where: {
        tenantId: user.tenantId,
        status: "approved",
      },
      orderBy: {
        approvedAt: "desc",
      },
    });

    const cooldownHours = 24; // Configurable
    const canChangeIP = !lastApprovedRequest || 
      (lastApprovedRequest.approvedAt && 
       new Date().getTime() - lastApprovedRequest.approvedAt.getTime() > cooldownHours * 60 * 60 * 1000);

    return NextResponse.json({
      license: {
        allowedIp: license.allowedIp,
        ipPolicy: license.ipPolicy,
        lastCheckinAt: license.lastCheckinAt,
      },
      current: {
        ip: currentIP,
        lastSeenIp: activeDevice?.registeredIp || null,
      },
      pendingRequest: pendingRequest
        ? {
            id: pendingRequest.id,
            newIp: pendingRequest.newIp,
            reason: pendingRequest.reason || null,
            requestedAt: pendingRequest.createdAt,
            requestedBy: pendingRequest.requestedByUserId,
            status: pendingRequest.status,
          }
        : null,
      cooldown: {
        canChange: canChangeIP,
        lastChange: lastApprovedRequest?.approvedAt || null,
        hoursRemaining: lastApprovedRequest && lastApprovedRequest.approvedAt
          ? Math.max(0, cooldownHours - Math.floor((Date.now() - lastApprovedRequest.approvedAt.getTime()) / (60 * 60 * 1000)))
          : 0,
      },
    });
  } catch (error: any) {
    console.error("IP status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get IP status" },
      { status: error.status || 500 }
    );
  }
}

// POST /api/licensing/ip - Set or request IP change
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    // Only owner/admin can manage IP
    if (user.role !== "owner" && user.role !== "super_admin") {
      return NextResponse.json(
        { error: "Only owner can manage IP address" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, ip: requestedIP, reason } = setIpSchema.parse(body);

    // Require reason for IP change requests
    if (action === "request" && !reason) {
      return NextResponse.json(
        { error: "Reason is required for IP change requests (minimum 10 characters)" },
        { status: 400 }
      );
    }

    const license = await prisma.license.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!license) {
      return NextResponse.json(
        { error: "License not found" },
        { status: 404 }
      );
    }

    if (license.status !== "active") {
      return NextResponse.json(
        { error: "License is not active" },
        { status: 403 }
      );
    }

    const currentIP = extractClientIP(request);
    const targetIP = requestedIP ? normalizeIP(requestedIP) : (currentIP ? normalizeIP(currentIP) : null);

    if (!targetIP) {
      return NextResponse.json(
        { error: "Could not determine IP address. Please specify an IP." },
        { status: 400 }
      );
    }

    // Check cooldown (24 hours)
    const lastApprovedRequest = await prisma.ipChangeRequest.findFirst({
      where: {
        tenantId: user.tenantId,
        status: "approved",
      },
      orderBy: {
        approvedAt: "desc",
      },
    });

    const cooldownHours = 24;
    if (lastApprovedRequest && lastApprovedRequest.approvedAt) {
      const hoursSinceLastChange = (Date.now() - lastApprovedRequest.approvedAt.getTime()) / (60 * 60 * 1000);
      if (hoursSinceLastChange < cooldownHours) {
        const hoursRemaining = Math.ceil(cooldownHours - hoursSinceLastChange);
        return NextResponse.json(
          { 
            error: `IP address can only be changed once per ${cooldownHours} hours. Please wait ${hoursRemaining} more hour(s).`,
            cooldown: {
              hoursRemaining,
              lastChange: lastApprovedRequest.approvedAt,
            },
          },
          { status: 429 }
        );
      }
    }

    if (action === "set") {
      // Direct set (requires MFA/re-auth - for now, just log it)
      // In production, add MFA challenge here

      // Update license
      await prisma.license.update({
        where: { id: license.id },
        data: { allowedIp: targetIP },
      });

      // Create approved request record
      await prisma.ipChangeRequest.create({
        data: {
          tenantId: user.tenantId,
          requestedByUserId: user.userId,
          newIp: targetIP,
          status: "approved",
          approvedByUserId: user.userId,
          approvedAt: new Date(),
        },
      });

      // Log action
      await prisma.licenseAuditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.userId,
          action: "IP_CHANGED",
          meta: {
            oldIp: license.allowedIp,
            newIp: targetIP,
            reason: "Owner set IP directly",
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: "IP address updated successfully",
        allowedIp: targetIP,
      });
    }

    // Request action (creates pending request)
    // In production, this would trigger email OTP or MFA challenge
    const pendingRequest = await prisma.ipChangeRequest.create({
      data: {
        tenantId: user.tenantId,
        requestedByUserId: user.userId,
        newIp: targetIP,
        reason: reason || null, // Reason for IP change
        status: "pending",
      },
    });

    // Log request
    await prisma.licenseAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.userId,
        action: "IP_CHANGE_REQUESTED",
        notes: `IP change requested. Reason: ${reason || "Not provided"}`,
        meta: {
          currentIp: license.allowedIp,
          requestedIp: targetIP,
          requestId: pendingRequest.id,
          reason: reason || null,
        },
      },
    });

    // For owner/admin, we can still auto-approve but log the action
    // In production, consider requiring admin approval even for owners
    if (user.role === "owner" || user.role === "super_admin") {
      await prisma.ipChangeRequest.update({
        where: { id: pendingRequest.id },
        data: {
          status: "approved",
          approvedByUserId: user.userId,
          approvedAt: new Date(),
        },
      });

      await prisma.license.update({
        where: { id: license.id },
        data: { 
          allowedIp: targetIP,
          registeredIp: targetIP, // Sync registeredIp
        },
      });

      await prisma.licenseAuditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.userId,
          action: "IP_CHANGED",
          notes: `IP change approved. Reason: ${reason || "Owner request"}`,
          meta: {
            oldIp: license.allowedIp,
            newIp: targetIP,
            requestId: pendingRequest.id,
            reason: reason || "Owner request auto-approved",
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: "IP change request approved",
        allowedIp: targetIP,
        requestId: pendingRequest.id,
      });
    }

    return NextResponse.json({
      success: true,
      message: "IP change request created. Pending approval.",
      requestId: pendingRequest.id,
    });
  } catch (error: any) {
    console.error("IP management error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to manage IP address" },
      { status: error.status || 500 }
    );
  }
}
