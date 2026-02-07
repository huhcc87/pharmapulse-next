/**
 * Licence Export API - PDF
 * 
 * Endpoints:
 * - GET: Export licence details as PDF
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { maskLicenceKey, getDaysRemaining } from "@/lib/licensing/licence-utils";
import { checkGracePeriod } from "@/lib/licensing/grace-period";

// Note: PDF generation would require a library like pdfkit or jspdf
// For now, we'll return JSON that can be formatted as PDF on client-side
// Or you can install pdfkit: npm install pdfkit @types/pdfkit

// GET /api/licensing/export/pdf - Export licence as PDF
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

    // Get recent audit logs
    const auditLogs = await prisma.licenseAuditLog.findMany({
      where: { licenceId: licence.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Get violations
    const violations = await prisma.licenseViolation.findMany({
      where: { licenceId: licence.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const graceStatus = await checkGracePeriod(licence);
    const daysRemaining = getDaysRemaining(licence.expiresAt);

    // Prepare PDF data
    const pdfData = {
      title: "Licence Summary",
      generatedAt: new Date().toISOString(),
      subscriber: {
        subscriber_id: licence.subscriberId || licence.tenantId,
        tenant_id: licence.tenantId,
      },
      licence: {
        licence_id: licence.id,
        licence_key: maskLicenceKey(licence.licenceKey),
        status: licence.status,
        expires_at: licence.expiresAt,
        days_remaining: daysRemaining,
        in_grace_period: graceStatus.inGrace,
        grace_until: graceStatus.graceUntil,
        licence_type: "1 PC / 1 IP / Annual",
        plan: licence.plan,
      },
      device: licence.deviceRegistrations[0] ? {
        operating_system: licence.deviceRegistrations[0].operatingSystem || "Unknown",
        browser: licence.deviceRegistrations[0].browser || "Unknown",
        registered_at: licence.deviceRegistrations[0].registeredAt,
        registered_ip: licence.deviceRegistrations[0].registeredIp,
      } : null,
      ip_address: licence.registeredIp || licence.allowedIp,
      validation: {
        last_validated_at: licence.lastValidatedAt,
        validation_count: licence.validationCount || 0,
      },
      violations: {
        total_count: licence.violationCount || 0,
        last_violation_at: licence.lastViolationAt,
        recent_violations: violations.map(v => ({
          type: v.violationType,
          reason: v.reason,
          timestamp: v.createdAt,
        })),
      },
      audit_summary: {
        total_actions: auditLogs.length,
        recent_actions: auditLogs.map(log => ({
          action: log.action,
          performed_by: log.actorUserId,
          timestamp: log.createdAt,
          notes: log.notes,
        })),
      },
      renewal: {
        renewal_code: licence.renewalCode || null,
        renewal_requested_at: licence.renewalRequestedAt,
        payment_reference_id: licence.paymentReferenceId || null,
      },
    };

    // For now, return JSON (can be formatted as PDF on client-side)
    // To implement actual PDF generation, install pdfkit and uncomment below
    /*
    const PDFDocument = require('pdfkit');
    const stream = new require('stream').PassThrough();
    
    const doc = new PDFDocument();
    // Build PDF here...
    doc.pipe(stream);
    doc.end();
    
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="licence-summary-${licence.id}.pdf"`,
      },
    });
    */

    return NextResponse.json({
      success: true,
      message: "PDF export data generated. Install pdfkit for actual PDF generation.",
      data: pdfData,
      format: "json", // Change to "pdf" when PDF generation is implemented
    });
  } catch (error: any) {
    console.error("PDF export error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF export", message: error.message },
      { status: 500 }
    );
  }
}
