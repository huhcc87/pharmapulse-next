/**
 * Security Configuration API
 * 
 * Manage security thresholds and settings
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserWithPermissions } from "@/lib/security/rbac";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateConfigSchema = z.object({
  refundThreshold: z.number().optional(),
  discountThreshold: z.number().optional(),
  exportRateLimit: z.number().optional(),
  stepUpTimeoutMinutes: z.number().optional(),
  supportSessionMinutes: z.number().optional(),
});

// GET /api/security/config - Get security configuration
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserWithPermissions();

    // Only OWNER/ADMIN can view config
    if (!user.roles.includes("OWNER") && !user.roles.includes("ADMIN")) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const config = await prisma.securityConfig.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!config) {
      // Create default config
      const defaultConfig = await prisma.securityConfig.create({
        data: {
          tenantId: user.tenantId,
          refundThreshold: 1000,
          discountThreshold: 10,
          exportRateLimit: 10,
          stepUpTimeoutMinutes: 10,
          supportSessionMinutes: 30,
        },
      });
      return NextResponse.json(defaultConfig);
    }

    return NextResponse.json(config);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to get config" },
      { status: error.status || 500 }
    );
  }
}

// PUT /api/security/config - Update security configuration
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserWithPermissions();

    // Only OWNER can update config
    if (!user.roles.includes("OWNER")) {
      return NextResponse.json(
        { error: "Only owner can update security configuration" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updates = updateConfigSchema.parse(body);

    const config = await prisma.securityConfig.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        refundThreshold: updates.refundThreshold ?? 1000,
        discountThreshold: updates.discountThreshold ?? 10,
        exportRateLimit: updates.exportRateLimit ?? 10,
        stepUpTimeoutMinutes: updates.stepUpTimeoutMinutes ?? 10,
        supportSessionMinutes: updates.supportSessionMinutes ?? 30,
      },
      update: {
        ...updates,
        updatedAt: new Date(),
      },
    });

    // Log to audit
    const { logSecurityAudit } = await import("@/lib/security/audit");
    await logSecurityAudit(user.tenantId, user.userId, "SECURITY_CONFIG_UPDATED", {
      updates,
    });

    return NextResponse.json(config);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to update config" },
      { status: error.status || 500 }
    );
  }
}
