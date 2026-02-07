/**
 * Analytics Audit Logging
 * 
 * Logs all analytics-related actions for compliance and security.
 */

import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export type AnalyticsAuditAction =
  | 'ANALYTICS_PAGE_VIEWED'
  | 'ANALYTICS_EXPORT'
  | 'ANALYTICS_PERMISSION_GRANTED'
  | 'ANALYTICS_PERMISSION_REVOKED'
  | 'ANALYTICS_STEPUP_SUCCESS'
  | 'ANALYTICS_STEPUP_FAILED'
  | 'ANALYTICS_QUERY_EXECUTED';

/**
 * Log analytics audit event
 */
export async function logAnalyticsAudit(
  tenantId: string,
  actorId: string,
  action: AnalyticsAuditAction,
  metadata?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string,
  correlationId?: string
): Promise<void> {
  try {
    // Get previous hash for chaining
    const lastLog = await prisma.auditLogsImmutable.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { hash: true },
    });

    const prevHash = lastLog?.hash || '';

    // Create hash
    const hashInput = `${prevHash}${tenantId}${actorId}${action}${JSON.stringify(metadata || {})}${new Date().toISOString()}`;
    const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

    await prisma.auditLogsImmutable.create({
      data: {
        actorId,
        actorRole: 'user', // Get from user context
        orgId: tenantId, // Assuming tenantId = orgId
        tenantId,
        action,
        targetType: 'analytics',
        metadata: metadata || {},
        ipAddress,
        userAgent,
        correlationId,
        prevHash,
        hash,
      },
    });
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('Failed to log analytics audit:', error);
  }
}

/**
 * Get analytics audit logs (Owner only)
 */
export async function getAnalyticsAuditLogs(
  tenantId: string,
  startDate?: Date,
  endDate?: Date,
  action?: AnalyticsAuditAction,
  actorId?: string
): Promise<Array<{
  id: string;
  actorId: string;
  action: string;
  metadata: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}>> {
  const logs = await prisma.auditLogsImmutable.findMany({
    where: {
      tenantId,
      action: {
        startsWith: 'ANALYTICS_',
      },
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
      ...(action && { action }),
      ...(actorId && { actorId }),
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 1000,
  });

  return logs.map(log => ({
    id: log.id,
    actorId: log.actorId,
    action: log.action,
    metadata: log.metadata,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt,
  }));
}
