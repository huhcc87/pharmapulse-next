/**
 * Admin Licence Management API
 * 
 * SECURE ADMIN ENDPOINT - Requires special admin code
 * 
 * This endpoint is protected by ADMIN_MASTER_SECRET environment variable.
 * Only admin with the secret code can access this endpoint.
 * 
 * Endpoints:
 * - GET: List all licences
 * - POST: Create new licence
 * - PUT: Update licence
 * - DELETE: Delete/revoke licence
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { 
  generateLicenceKey,
  generateRenewalCode,
  maskLicenceKey,
  getDaysRemaining,
} from "@/lib/licensing/licence-utils";
import { z } from "zod";
import crypto from "crypto";

// SECURE: Admin master secret - MUST be set in environment variables
const ADMIN_MASTER_SECRET = process.env.ADMIN_MASTER_SECRET || "CHANGE_THIS_IN_PRODUCTION";
const ADMIN_MASTER_CODE = process.env.ADMIN_MASTER_CODE || "ADMIN2024SECURE";

/**
 * Verify admin authentication
 * Requires special admin code in header
 */
function verifyAdminAccess(request: NextRequest): { authorized: boolean; error?: string } {
  try {
    // Method 1: Check for admin code in header
    const adminCode = request.headers.get("X-Admin-Code");
    if (adminCode && adminCode === ADMIN_MASTER_CODE) {
      return { authorized: true };
    }

    // Method 2: Check for bearer token with admin secret
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      if (token === ADMIN_MASTER_SECRET) {
        return { authorized: true };
      }
    }

    // Method 3: Check for admin code in request body (for POST requests)
    // This will be checked in the route handler

    return { 
      authorized: false, 
      error: "Unauthorized. Admin code or secret required." 
    };
  } catch {
    return { 
      authorized: false, 
      error: "Unauthorized. Admin authentication failed." 
    };
  }
}

// Validation schemas
const createLicenceSchema = z.object({
  tenantId: z.string().min(1, "Tenant ID is required"),
  subscriberId: z.string().optional(),
  durationYears: z.number().min(1).max(10).default(1),
  maxDevices: z.number().min(1).max(5).default(1),
  plan: z.string().default("professional"),
  status: z.enum(["active", "suspended", "expired"]).default("active"),
  adminCode: z.string().optional(), // For POST body auth
});

const updateLicenceSchema = z.object({
  tenantId: z.string().optional(),
  subscriberId: z.string().optional(),
  status: z.enum(["active", "suspended", "expired", "pending_renewal"]).optional(),
  expiresAt: z.string().datetime().optional(),
  maxDevices: z.number().min(1).max(5).optional(),
  renewalCode: z.string().nullable().optional(),
  registeredDeviceFingerprint: z.string().nullable().optional(),
  registeredIp: z.string().nullable().optional(),
  adminCode: z.string().optional(), // For PUT body auth
});

const deleteLicenceSchema = z.object({
  adminCode: z.string().optional(),
  reason: z.string().optional(),
});

/**
 * GET /api/admin/licences - List all licences
 * 
 * Query params:
 * - status: Filter by status (active, expired, suspended, pending_renewal)
 * - tenantId: Filter by tenant ID
 * - limit: Limit results (default: 100)
 * - offset: Offset for pagination
 * 
 * Headers:
 * - X-Admin-Code: {ADMIN_MASTER_CODE}
 * OR
 * - Authorization: Bearer {ADMIN_MASTER_SECRET}
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const authCheck = verifyAdminAccess(request);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { 
          error: "UNAUTHORIZED",
          message: authCheck.error || "Admin authentication required",
          hint: "Use X-Admin-Code header or Authorization Bearer token"
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as any;
    const tenantId = searchParams.get("tenantId");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: any = {};
    if (status) where.status = status;
    if (tenantId) where.tenantId = tenantId;

    const [licences, total] = await Promise.all([
      prisma.license.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          tenantId: true,
          licenceKey: true,
          registeredDeviceFingerprint: true,
          registeredIp: true,
          allowedIp: true,
          expiresAt: true,
          status: true,
          renewalCode: true,
          plan: true,
          maxDevices: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.license.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      licences: licences.map(licence => ({
        licence_id: licence.id,
        tenant_id: licence.tenantId,
        subscriber_id: licence.tenantId, // subscriberId is alias for tenantId
        licence_key: maskLicenceKey(licence.licenceKey),
        licence_key_full: licence.licenceKey, // Full key for admin
        registered_device_fingerprint: licence.registeredDeviceFingerprint ? "***" : null,
        registered_ip: licence.registeredIp || licence.allowedIp,
        expires_at: licence.expiresAt,
        status: licence.status,
        renewal_code: licence.renewalCode,
        plan: licence.plan,
        max_devices: licence.maxDevices,
        days_remaining: getDaysRemaining(licence.expiresAt),
        created_at: licence.createdAt,
        updated_at: licence.updatedAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error("Admin licence list error:", error);
    return NextResponse.json(
      { error: "Failed to list licences", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/licences - Create new licence
 * 
 * Body:
 * {
 *   "tenantId": "tenant-id",
 *   "subscriberId": "user-id" (optional),
 *   "durationYears": 1 (optional, default: 1),
 *   "maxDevices": 1 (optional, default: 1),
 *   "plan": "professional" (optional),
 *   "status": "active" (optional),
 *   "adminCode": "{ADMIN_MASTER_CODE}" (required if not in header)
 * }
 * 
 * Headers:
 * - X-Admin-Code: {ADMIN_MASTER_CODE}
 * OR
 * - Authorization: Bearer {ADMIN_MASTER_SECRET}
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Check for admin code in body first
    const hasBodyAdminCode = body.adminCode === ADMIN_MASTER_CODE;
    
    // Verify admin access (check header OR body)
    let authCheck = verifyAdminAccess(request);
    if (!authCheck.authorized && !hasBodyAdminCode) {
      return NextResponse.json(
        { 
          error: "UNAUTHORIZED",
          message: "Admin authentication required",
          hint: "Provide adminCode in body or use X-Admin-Code header/Authorization Bearer token"
        },
        { status: 401 }
      );
    }

    // Parse and validate body
    const { adminCode, ...data } = createLicenceSchema.parse(body);

    // Check if licence already exists
    const existing = await prisma.license.findUnique({
      where: { tenantId: data.tenantId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Licence already exists for this tenant", licence_id: existing.id },
        { status: 400 }
      );
    }

    // Generate licence key
    const licenceKey = generateLicenceKey();

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + data.durationYears);

    // Create licence
    const licence = await prisma.license.create({
      data: {
        tenantId: data.tenantId,
        subscriberId: data.subscriberId || data.tenantId,
        licenceKey,
        status: data.status,
        expiresAt,
        maxDevices: data.maxDevices,
        plan: data.plan,
        ipPolicy: "single",
      },
    });

    // Log action
    await prisma.licenseAuditLog.create({
      data: {
        tenantId: data.tenantId,
        licenceId: licence.id,
        actorUserId: "ADMIN",
        action: "admin_create_licence",
        notes: `Licence created by admin. Duration: ${data.durationYears} year(s). Status: ${data.status}`,
        meta: {
          durationYears: data.durationYears,
          maxDevices: data.maxDevices,
          plan: data.plan,
          createdBy: "ADMIN_API",
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Licence created successfully",
      licence: {
        licence_id: licence.id,
        tenant_id: licence.tenantId,
        subscriber_id: licence.subscriberId || licence.tenantId, // subscriberId is alias for tenantId
        licence_key: licence.licenceKey, // Full key returned to admin
        expires_at: licence.expiresAt,
        status: licence.status,
        days_remaining: getDaysRemaining(licence.expiresAt),
      },
    }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Admin licence create error:", error);
    return NextResponse.json(
      { error: "Failed to create licence", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/licences/:licenceId - Update licence
 * 
 * Body:
 * {
 *   "status": "active" | "suspended" | "expired" | "pending_renewal",
 *   "expiresAt": "2025-12-31T00:00:00Z" (ISO date string),
 *   "maxDevices": 1,
 *   "renewalCode": null,
 *   "registeredDeviceFingerprint": null,
 *   "registeredIp": null,
 *   "adminCode": "{ADMIN_MASTER_CODE}" (required if not in header)
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const licenceId = searchParams.get("licenceId");
    
    if (!licenceId) {
      return NextResponse.json(
        { error: "licenceId query parameter is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Check for admin code in body first
    const hasBodyAdminCode = body.adminCode === ADMIN_MASTER_CODE;
    
    // Verify admin access
    let authCheck = verifyAdminAccess(request);
    if (!authCheck.authorized && !hasBodyAdminCode) {
      return NextResponse.json(
        { 
          error: "UNAUTHORIZED",
          message: "Admin authentication required"
        },
        { status: 401 }
      );
    }

    const { adminCode, ...updateData } = updateLicenceSchema.parse(body);

    // Find licence
    const licence = await prisma.license.findUnique({
      where: { id: licenceId },
    });

    if (!licence) {
      return NextResponse.json(
        { error: "Licence not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updatePayload: any = {};
    if (updateData.status !== undefined) updatePayload.status = updateData.status;
    if (updateData.expiresAt !== undefined) updatePayload.expiresAt = new Date(updateData.expiresAt);
    if (updateData.maxDevices !== undefined) updatePayload.maxDevices = updateData.maxDevices;
    if (updateData.renewalCode !== undefined) updatePayload.renewalCode = updateData.renewalCode;
    if (updateData.registeredDeviceFingerprint !== undefined) {
      updatePayload.registeredDeviceFingerprint = updateData.registeredDeviceFingerprint;
    }
    if (updateData.registeredIp !== undefined) {
      updatePayload.registeredIp = updateData.registeredIp;
      updatePayload.allowedIp = updateData.registeredIp; // Sync
    }
    if (updateData.tenantId !== undefined) updatePayload.tenantId = updateData.tenantId;
    if (updateData.subscriberId !== undefined) updatePayload.subscriberId = updateData.subscriberId;

    // Update licence
    const updatedLicence = await prisma.license.update({
      where: { id: licenceId },
      data: updatePayload,
    });

    // Log action
    await prisma.licenseAuditLog.create({
      data: {
        tenantId: updatedLicence.tenantId,
        licenceId: updatedLicence.id,
        actorUserId: "ADMIN",
        action: "admin_update_licence",
        notes: `Licence updated by admin. Changes: ${JSON.stringify(updateData)}`,
        meta: {
          updatedFields: Object.keys(updateData),
          previousStatus: licence.status,
          newStatus: updatedLicence.status,
          updatedBy: "ADMIN_API",
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Licence updated successfully",
      licence: {
        licence_id: updatedLicence.id,
        tenant_id: updatedLicence.tenantId,
        status: updatedLicence.status,
        expires_at: updatedLicence.expiresAt,
        days_remaining: getDaysRemaining(updatedLicence.expiresAt),
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Admin licence update error:", error);
    return NextResponse.json(
      { error: "Failed to update licence", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/licences/:licenceId - Delete/Revoke licence
 * 
 * Query params:
 * - licenceId: Licence ID to delete
 * 
 * Body (optional):
 * {
 *   "adminCode": "{ADMIN_MASTER_CODE}",
 *   "reason": "Reason for deletion"
 * }
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const licenceId = searchParams.get("licenceId");
    
    if (!licenceId) {
      return NextResponse.json(
        { error: "licenceId query parameter is required" },
        { status: 400 }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional
    }

    // Check for admin code in body first
    const hasBodyAdminCode = body.adminCode === ADMIN_MASTER_CODE;
    
    // Verify admin access
    let authCheck = verifyAdminAccess(request);
    if (!authCheck.authorized && !hasBodyAdminCode) {
      return NextResponse.json(
        { 
          error: "UNAUTHORIZED",
          message: "Admin authentication required"
        },
        { status: 401 }
      );
    }

    // Find licence
    const licence = await prisma.license.findUnique({
      where: { id: licenceId },
    });

    if (!licence) {
      return NextResponse.json(
        { error: "Licence not found" },
        { status: 404 }
      );
    }

    // Log action before deletion
    await prisma.licenseAuditLog.create({
      data: {
        tenantId: licence.tenantId,
        licenceId: licence.id,
        actorUserId: "ADMIN",
        action: "admin_delete_licence",
        notes: `Licence deleted/revoked by admin. Reason: ${body.reason || "No reason provided"}`,
        meta: {
          reason: body.reason || null,
          previousStatus: licence.status,
          deletedBy: "ADMIN_API",
        },
      },
    });

    // Delete licence (this will cascade delete audit logs due to onDelete: Cascade)
    await prisma.license.delete({
      where: { id: licenceId },
    });

    return NextResponse.json({
      success: true,
      message: "Licence deleted successfully",
      deleted_licence_id: licenceId,
    });
  } catch (error: any) {
    console.error("Admin licence delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete licence", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/licences/:licenceId/renew - Renew licence (Admin)
 * 
 * Query params:
 * - licenceId: Licence ID to renew
 * 
 * Body:
 * {
 *   "durationYears": 1 (optional, default: 1),
 *   "adminCode": "{ADMIN_MASTER_CODE}" (required if not in header)
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const licenceId = searchParams.get("licenceId");
    
    if (!licenceId) {
      return NextResponse.json(
        { error: "licenceId query parameter is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Check for admin code
    const hasBodyAdminCode = body.adminCode === ADMIN_MASTER_CODE;
    let authCheck = verifyAdminAccess(request);
    if (!authCheck.authorized && !hasBodyAdminCode) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Admin authentication required" },
        { status: 401 }
      );
    }

    const durationYears = body.durationYears || 1;

    // Find licence
    const licence = await prisma.license.findUnique({
      where: { id: licenceId },
    });

    if (!licence) {
      return NextResponse.json(
        { error: "Licence not found" },
        { status: 404 }
      );
    }

    // Generate new licence key and expiry
    const newLicenceKey = generateLicenceKey();
    const newExpiresAt = new Date();
    newExpiresAt.setFullYear(newExpiresAt.getFullYear() + durationYears);

    // Update licence
    const updatedLicence = await prisma.license.update({
      where: { id: licenceId },
      data: {
        licenceKey: newLicenceKey,
        expiresAt: newExpiresAt,
        registeredDeviceFingerprint: null, // Reset - user must re-register
        registeredIp: null,
        allowedIp: null,
        status: "active",
        renewalCode: null, // Clear renewal code
      },
    });

    // Log action
    await prisma.licenseAuditLog.create({
      data: {
        tenantId: licence.tenantId,
        licenceId: licence.id,
        actorUserId: "ADMIN",
        action: "admin_renew_licence",
        notes: `Licence renewed by admin. New duration: ${durationYears} year(s). New expiry: ${newExpiresAt.toISOString()}`,
        meta: {
          previousExpiry: licence.expiresAt,
          newExpiry: newExpiresAt,
          durationYears,
          previousKey: licence.licenceKey,
          newKey: newLicenceKey,
          renewedBy: "ADMIN_API",
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Licence renewed successfully. User must re-register device.",
      licence: {
        licence_id: updatedLicence.id,
        tenant_id: updatedLicence.tenantId,
        new_licence_key: updatedLicence.licenceKey, // Full new key
        expires_at: updatedLicence.expiresAt,
        status: updatedLicence.status,
        days_remaining: getDaysRemaining(updatedLicence.expiresAt),
      },
    });
  } catch (error: any) {
    console.error("Admin licence renew error:", error);
    return NextResponse.json(
      { error: "Failed to renew licence", message: error.message },
      { status: 500 }
    );
  }
}
