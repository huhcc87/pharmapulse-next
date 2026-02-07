/**
 * Renewal Request API
 * 
 * Endpoints:
 * - POST: Request licence renewal
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { generateRenewalCode } from "@/lib/licensing/licence-utils";

// POST /api/licensing/renewal-request - Request renewal
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const licence = await prisma.license.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!licence) {
      return NextResponse.json(
        { error: "Licence not found" },
        { status: 404 }
      );
    }

    // Generate renewal code if not exists
    let renewalCode = licence.renewalCode;
    if (!renewalCode) {
      renewalCode = generateRenewalCode(licence.id);
    }

    // Update licence with renewal request
    const updatedLicence = await prisma.license.update({
      where: { id: licence.id },
      data: {
        renewalCode,
        renewalRequestedAt: new Date(),
        status: licence.status === "expired" ? "expired" : "pending_renewal",
      },
    });

    // Log action
    await prisma.licenseAuditLog.create({
      data: {
        tenantId: user.tenantId,
        licenceId: licence.id,
        actorUserId: user.userId,
        action: "renew_request",
        notes: `Renewal requested by user. Renewal code: ${renewalCode}`,
        meta: {
          renewalCode,
          requestedAt: new Date(),
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Renewal request submitted. Please contact admin with your renewal code.",
      renewal_code: renewalCode,
      status: updatedLicence.status,
    });
  } catch (error: any) {
    console.error("Renewal request error:", error);
    return NextResponse.json(
      { error: "Failed to request renewal", message: error.message },
      { status: 500 }
    );
  }
}
