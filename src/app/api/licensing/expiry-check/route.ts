/**
 * Daily Expiry Check Job
 * 
 * This endpoint should be called by a cron job (e.g., Vercel Cron, or external service)
 * to check and expire licences daily.
 * 
 * Endpoint:
 * - POST: Check and expire licences (requires secret token)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateRenewalCode } from "@/lib/licensing/licence-utils";

const EXPIRY_CHECK_SECRET = process.env.EXPIRY_CHECK_SECRET || "change-me-in-production";

// POST /api/licensing/expiry-check - Daily job to expire licences
export async function POST(request: NextRequest) {
  try {
    // Verify secret token
    const authHeader = request.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${EXPIRY_CHECK_SECRET}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = new Date();

    // Find all active licences that have expired
    const expiredLicences = await prisma.license.findMany({
      where: {
        status: {
          in: ["active", "pending_renewal"],
        },
        expiresAt: {
          lt: now,
        },
      },
    });

    let expiredCount = 0;
    let renewalCodesGenerated = 0;

    for (const licence of expiredLicences) {
      // Set status to expired
      await prisma.license.update({
        where: { id: licence.id },
        data: {
          status: "expired",
          renewalCode: licence.renewalCode || generateRenewalCode(licence.id),
        },
      });

      expiredCount++;

      // Generate renewal code if not exists
      if (!licence.renewalCode) {
        const renewalCode = generateRenewalCode(licence.id);
        await prisma.license.update({
          where: { id: licence.id },
          data: { renewalCode },
        });
        renewalCodesGenerated++;

        // TODO: Send email/SMS notification to subscriber
        // This would require integration with email/SMS service
        // Example:
        // await sendExpiryNotification({
        //   to: licence.billingEmail,
        //   renewalCode,
        //   licenceId: licence.id,
        // });
      }

      // Log expiry
      await prisma.licenseAuditLog.create({
        data: {
          tenantId: licence.tenantId,
          licenceId: licence.id,
          action: "renew_request",
          notes: `Licence expired. Renewal code: ${licence.renewalCode || "generated"}`,
          meta: {
            expiresAt: licence.expiresAt,
            renewalCode: licence.renewalCode,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Expiry check completed. ${expiredCount} licence(s) expired, ${renewalCodesGenerated} renewal code(s) generated.`,
      stats: {
        expired_count: expiredCount,
        renewal_codes_generated: renewalCodesGenerated,
        checked_at: now.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Expiry check error:", error);
    return NextResponse.json(
      { error: "Failed to run expiry check", message: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint for manual testing (without secret in production)
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    );
  }

  // In development, allow manual trigger
  return POST(request);
}
