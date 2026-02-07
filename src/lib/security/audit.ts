/**
 * Tamper-evident Audit Logging with Hash Chaining
 * 
 * Implements append-only audit logs with cryptographic hash chaining
 * to detect tampering. Each log entry includes hash of previous entry.
 */

import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

/**
 * Calculate hash for audit log entry
 * Hash = SHA-256(prev_hash + tenant_id + actor_user_id + action + meta + created_at)
 */
function calculateAuditHash(
  prevHash: string | null,
  tenantId: string,
  actorUserId: string | null,
  action: string,
  meta: Record<string, any> | null,
  createdAt: Date
): string {
  const hashInput = [
    prevHash || "",
    tenantId,
    actorUserId || "",
    action,
    JSON.stringify(meta || {}),
    createdAt.toISOString(),
  ].join("|");

  return createHash("sha256").update(hashInput).digest("hex");
}

/**
 * Get the last audit log entry for a tenant (to get prev_hash)
 */
async function getLastAuditLogHash(tenantId: string): Promise<string | null> {
  const lastLog = await prisma.securityAuditLog.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: { hash: true },
  });

  return lastLog?.hash || null;
}

/**
 * Log an action to tamper-evident audit log
 * 
 * @param tenantId - Tenant ID
 * @param actorUserId - User who performed the action (null for system)
 * @param action - Action type (e.g., "REFUND_CREATED", "USER_DELETED")
 * @param meta - Additional metadata (JSON object)
 */
export async function logSecurityAudit(
  tenantId: string,
  actorUserId: string | null,
  action: string,
  meta: Record<string, any> | null = null
): Promise<string> {
  // Get previous hash for chain
  const prevHash = await getLastAuditLogHash(tenantId);

  // Create log entry
  const createdAt = new Date();
  const hash = calculateAuditHash(prevHash, tenantId, actorUserId, action, meta, createdAt);

  const logEntry = await prisma.securityAuditLog.create({
    data: {
      tenantId,
      actorUserId,
      action,
      meta,
      prevHash,
      hash,
      createdAt,
    },
  });

  return logEntry.id;
}

/**
 * Verify audit log integrity for a tenant
 * Checks that all hashes in the chain are valid
 * 
 * @param tenantId - Tenant ID
 * @returns { valid: boolean, invalidEntries: Array<{id, expectedHash, actualHash}> }
 */
export async function verifyAuditLogIntegrity(
  tenantId: string
): Promise<{
  valid: boolean;
  invalidEntries: Array<{ id: string; expectedHash: string; actualHash: string }>;
}> {
  const logs = await prisma.securityAuditLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });

  const invalidEntries: Array<{ id: string; expectedHash: string; actualHash: string }> = [];
  let prevHash: string | null = null;

  for (const log of logs) {
    const expectedHash = calculateAuditHash(
      prevHash,
      log.tenantId,
      log.actorUserId,
      log.action,
      log.meta as Record<string, any> | null,
      log.createdAt
    );

    if (log.hash !== expectedHash) {
      invalidEntries.push({
        id: log.id,
        expectedHash,
        actualHash: log.hash,
      });
    }

    prevHash = log.hash;
  }

  return {
    valid: invalidEntries.length === 0,
    invalidEntries,
  };
}

/**
 * Get audit logs for a tenant (paginated)
 * Only users with VIEW_AUDIT permission should access this
 */
export async function getAuditLogs(
  tenantId: string,
  options: {
    limit?: number;
    offset?: number;
    action?: string;
    actorUserId?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{
  logs: Array<{
    id: string;
    actorUserId: string | null;
    action: string;
    meta: any;
    hash: string;
    prevHash: string | null;
    createdAt: Date;
  }>;
  total: number;
}> {
  const {
    limit = 50,
    offset = 0,
    action,
    actorUserId,
    startDate,
    endDate,
  } = options;

  const where: any = { tenantId };

  if (action) where.action = action;
  if (actorUserId) where.actorUserId = actorUserId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.securityAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        actorUserId: true,
        action: true,
        meta: true,
        hash: true,
        prevHash: true,
        createdAt: true,
      },
    }),
    prisma.securityAuditLog.count({ where }),
  ]);

  return { logs, total };
}

/**
 * Export audit logs (requires step-up auth and EXPORT_DATA permission)
 * Returns audit logs with integrity verification
 */
export async function exportAuditLogs(
  tenantId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    format?: "json" | "csv";
  } = {}
): Promise<{
  logs: any[];
  integrity: { valid: boolean; invalidEntries: any[] };
  exportedAt: Date;
}> {
  const { startDate, endDate } = options;

  // Get all logs in date range
  const where: any = { tenantId };
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const logs = await prisma.securityAuditLog.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });

  // Verify integrity
  const integrity = await verifyAuditLogIntegrity(tenantId);

  return {
    logs: logs.map((log) => ({
      id: log.id,
      tenantId: log.tenantId,
      actorUserId: log.actorUserId,
      action: log.action,
      meta: log.meta,
      hash: log.hash,
      prevHash: log.prevHash,
      createdAt: log.createdAt,
    })),
    integrity,
    exportedAt: new Date(),
  };
}
