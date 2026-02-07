/**
 * Export Controls with Watermarking
 * 
 * Tracks all data exports with watermarking metadata
 * Requires EXPORT_DATA permission and step-up auth
 */

import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { requirePermission } from "./rbac";
import { requireStepUpAuth } from "./step-up-auth";
import { logSecurityAudit } from "./audit";
import { extractClientIP } from "@/lib/licensing/ip-extraction";
import { NextRequest } from "next/server";

/**
 * Check export rate limit for user
 * Returns true if within limit, false if exceeded
 */
async function checkExportRateLimit(
  tenantId: string,
  userId: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const config = await prisma.securityConfig.findUnique({
    where: { tenantId },
  });

  const rateLimit = config?.exportRateLimit || 10; // Default 10 per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Count exports in last hour
  const recentExports = await prisma.exportRecord.count({
    where: {
      tenantId,
      userId,
      createdAt: {
        gte: oneHourAgo,
      },
    },
  });

  const remaining = Math.max(0, rateLimit - recentExports);
  const resetAt = new Date(Date.now() + 60 * 60 * 1000);

  return {
    allowed: recentExports < rateLimit,
    remaining,
    resetAt,
  };
}

/**
 * Create export record with watermarking
 * Requires EXPORT_DATA permission and step-up auth
 */
export async function createExportRecord(
  tenantId: string,
  userId: string,
  exportType: string,
  request: NextRequest,
  filePath?: string
): Promise<{
  exportId: string;
  watermark: Record<string, any>;
}> {
  // Check permission
  await requirePermission(userId, tenantId, "EXPORT_DATA");

  // Check step-up auth
  await requireStepUpAuth(tenantId, userId);

  // Check rate limit
  const rateLimit = await checkExportRateLimit(tenantId, userId);
  if (!rateLimit.allowed) {
    const err = new Error("Export rate limit exceeded");
    // @ts-ignore
    err.status = 429;
    // @ts-ignore
    err.code = "EXPORT_RATE_LIMIT";
    // @ts-ignore
    err.details = {
      remaining: rateLimit.remaining,
      resetAt: rateLimit.resetAt,
    };
    throw err;
  }

  // Generate unique export ID
  const exportId = randomUUID();

  // Create watermark metadata
  const watermark = {
    tenantId,
    userId,
    timestamp: new Date().toISOString(),
    exportType,
    exportId,
  };

  // Create export record
  const ipAddress = extractClientIP(request);
  const userAgent = request.headers.get("user-agent");

  await prisma.exportRecord.create({
    data: {
      tenantId,
      userId,
      exportType,
      exportId,
      filePath,
      watermark,
      ipAddress,
      userAgent,
    },
  });

  // Log to audit
  await logSecurityAudit(tenantId, userId, "EXPORT_CREATED", {
    exportId,
    exportType,
    filePath,
  });

  return { exportId, watermark };
}

/**
 * Get export records for a tenant
 * Requires VIEW_AUDIT permission
 */
export async function getExportRecords(
  tenantId: string,
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    exportType?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{
  exports: any[];
  total: number;
}> {
  // Check permission
  await requirePermission(userId, tenantId, "VIEW_AUDIT");

  const {
    limit = 50,
    offset = 0,
    exportType,
    startDate,
    endDate,
  } = options;

  const where: any = { tenantId };
  if (exportType) where.exportType = exportType;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [exports, total] = await Promise.all([
    prisma.exportRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.exportRecord.count({ where }),
  ]);

  return { exports, total };
}

/**
 * Add watermark to exported file content
 * For PDFs, invoices, CSV files, etc.
 */
export function addWatermarkToContent(
  content: string | Buffer,
  watermark: Record<string, any>,
  format: "pdf" | "csv" | "json" = "json"
): string | Buffer {
  switch (format) {
    case "json":
      // Add watermark as metadata in JSON
      const json = JSON.parse(content.toString());
      json._watermark = watermark;
      return JSON.stringify(json, null, 2);

    case "csv":
      // Add watermark as comment/header in CSV
      const csvLines = content.toString().split("\n");
      const watermarkLine = `# WATERMARK: ${JSON.stringify(watermark)}`;
      return [watermarkLine, ...csvLines].join("\n");

    case "pdf":
      // For PDFs, watermark would be added during PDF generation
      // This is a placeholder - actual PDF watermarking requires pdf-lib or similar
      return content;

    default:
      return content;
  }
}
