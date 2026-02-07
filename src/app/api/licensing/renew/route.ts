/**
 * Licence Renewal API (Admin Only)
 * 
 * Endpoints:
 * - POST: Approve renewal and regenerate licence
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { generateLicenceKey, verifyRenewalCode, isRenewalCodeExpired } from "@/lib/licensing/licence-utils";
import { z } from "zod";

const renewLicenceSchema = z.object({
  renewal_code: z.string(),
  licence_id: z.string().optional(),
});

// POST /api/licensing/renew - Approve renewal (Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    // Only admin/owner can approve renewals
    if (user.role !== "owner" && user.role !== "super_admin") {
      return NextResponse.json(
        { error: "Only admin can approve licence renewals" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { renewal_code, licence_id } = renewLicenceSchema.parse(body);

    // Find licence by renewal code or ID
    let licence;
    if (licence_id) {
      licence = await prisma.license.findUnique({
        where: { id: licence_id },
      });
    } else {
      // Find by renewal code
      licence = await prisma.license.findFirst({
        where: { renewalCode: renewal_code },
      });
    }

    if (!licence) {
      return NextResponse.json(
        { error: "Licence not found" },
        { status: 404 }
      );
    }

    // Verify renewal code if provided
    if (renewal_code && !verifyRenewalCode(renewal_code, licence.id)) {
      return NextResponse.json(
        { error: "Invalid renewal code" },
        { status: 400 }
      );
    }

    // Check if renewal code has expired (30 days)
    if (licence.renewalCode && licence.updatedAt) {
      if (isRenewalCodeExpired(licence.updatedAt)) {
        return NextResponse.json(
          { error: "Renewal code has expired (30 days)" },
          { status: 400 }
        );
      }
    }

    // Generate new licence key
    const newLicenceKey = generateLicenceKey();

    // Set expiry to 1 year from now
    const newExpiresAt = new Date();
    newExpiresAt.setFullYear(newExpiresAt.getFullYear() + 1);

    // Reset device and IP (user must re-register)
    const updatedLicence = await prisma.license.update({
      where: { id: licence.id },
      data: {
        licenceKey: newLicenceKey,
        expiresAt: newExpiresAt,
        registeredDeviceFingerprint: null,
        registeredIp: null,
        allowedIp: null,
        status: "active",
        renewalCode: null, // Clear renewal code
      },
    });

    // Log renewal approval
    await prisma.licenseAuditLog.create({
      data: {
        tenantId: licence.tenantId,
        licenceId: licence.id,
        actorUserId: user.userId,
        action: "renew_approve",
        notes: `Licence renewed. New expiry: ${newExpiresAt.toISOString()}`,
        meta: {
          previousExpiry: licence.expiresAt,
          newExpiry: newExpiresAt,
          renewalCode: renewal_code,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Licence renewed successfully. User must re-register device.",
      licence: {
        licence_id: updatedLicence.id,
        expires_at: updatedLicence.expiresAt,
        status: updatedLicence.status,
      },
    });
  } catch (error: any) {
    console.error("Licence renewal error:", error);
    return NextResponse.json(
      { error: "Failed to renew licence", message: error.message },
      { status: error.status || 500 }
    );
  }
}
