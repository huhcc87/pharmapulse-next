/**
 * Licence Export API - CSV
 * 
 * Endpoints:
 * - GET: Export licence details as CSV
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { maskLicenceKey, getDaysRemaining } from "@/lib/licensing/licence-utils";
import { checkGracePeriod } from "@/lib/licensing/grace-period";

// GET /api/licensing/export/csv - Export licence as CSV
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const licence = await prisma.license.findUnique({
      where: { tenantId: user.tenantId },
      include: {
        deviceRegistrations: {
          where: { revokedAt: null },
          take: 1,
          orderBy: { registeredAt: "desc" },
        },
      },
    });

    if (!licence) {
      return NextResponse.json(
        { error: "Licence not found" },
        { status: 404 }
      );
    }

    // Get audit logs
    const auditLogs = await prisma.licenseAuditLog.findMany({
      where: { licenceId: licence.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Get violations
    const violations = await prisma.licenseViolation.findMany({
      where: { licenceId: licence.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const graceStatus = await checkGracePeriod(licence);
    const daysRemaining = getDaysRemaining(licence.expiresAt);

    // Build CSV content
    const csvLines: string[] = [];

    // Header
    csvLines.push("Licence Export");
    csvLines.push(`Generated At,${new Date().toISOString()}`);
    csvLines.push("");

    // Licence Details
    csvLines.push("Licence Details");
    csvLines.push("Field,Value");
    csvLines.push(`Licence ID,${licence.id}`);
    csvLines.push(`Subscriber ID,${licence.subscriberId || licence.tenantId}`);
    csvLines.push(`Licence Key,${maskLicenceKey(licence.licenceKey)}`);
    csvLines.push(`Status,${licence.status}`);
    csvLines.push(`Expires At,${licence.expiresAt?.toISOString() || "N/A"}`);
    csvLines.push(`Days Remaining,${daysRemaining !== null ? daysRemaining : "N/A"}`);
    csvLines.push(`In Grace Period,${graceStatus.inGrace ? "Yes" : "No"}`);
    csvLines.push(`Grace Until,${graceStatus.graceUntil?.toISOString() || "N/A"}`);
    csvLines.push(`Licence Type,1 PC / 1 IP / Annual`);
    csvLines.push(`Plan,${licence.plan}`);
    csvLines.push(`Registered IP,${licence.registeredIp || licence.allowedIp || "N/A"}`);
    csvLines.push(`Last Validated At,${licence.lastValidatedAt?.toISOString() || "N/A"}`);
    csvLines.push(`Validation Count,${licence.validationCount || 0}`);
    csvLines.push(`Violation Count,${licence.violationCount || 0}`);
    csvLines.push(`Last Violation At,${licence.lastViolationAt?.toISOString() || "N/A"}`);
    csvLines.push("");

    // Device Information
    if (licence.deviceRegistrations[0]) {
      const device = licence.deviceRegistrations[0];
      csvLines.push("Device Information");
      csvLines.push("Field,Value");
      csvLines.push(`Operating System,${device.operatingSystem || "Unknown"}`);
      csvLines.push(`Browser,${device.browser || "Unknown"}`);
      csvLines.push(`Registered At,${device.registeredAt.toISOString()}`);
      csvLines.push(`Last Seen At,${device.lastSeenAt.toISOString()}`);
      csvLines.push(`Registered IP,${device.registeredIp || "N/A"}`);
      csvLines.push("");
    }

    // Violations
    csvLines.push("Recent Violations");
    csvLines.push("Type,Reason,IP Address,Timestamp");
    violations.forEach(v => {
      csvLines.push(`"${v.violationType}","${v.reason}","${v.ipAddress || "N/A"}","${v.createdAt.toISOString()}"`);
    });
    csvLines.push("");

    // Audit Logs
    csvLines.push("Audit Logs");
    csvLines.push("Action,Performed By,Notes,Timestamp");
    auditLogs.forEach(log => {
      csvLines.push(`"${log.action}","${log.actorUserId || "N/A"}","${log.notes || ""}","${log.createdAt.toISOString()}"`);
    });

    const csvContent = csvLines.join("\n");

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="licence-export-${licence.id}-${Date.now()}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("CSV export error:", error);
    return NextResponse.json(
      { error: "Failed to generate CSV export", message: error.message },
      { status: 500 }
    );
  }
}
