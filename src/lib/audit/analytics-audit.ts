/**
 * Analytics Audit Logging
 *
 * Your Prisma schema does NOT include `auditLogsImmutable`,
 * so this module must not call `prisma.auditLogsImmutable.*`.
 *
 * This drop-in replacement:
 * - keeps the same public API
 * - never fails requests (audit logging is best-effort)
 * - writes to server logs for now
 * - returns [] for queries
 *
 * Later, when you add a real Prisma model (e.g., AuditLog),
 * you can wire it back up safely.
 */

import crypto from "crypto";

export type AnalyticsAuditAction =
  | "ANALYTICS_PAGE_VIEWED"
  | "ANALYTICS_EXPORT"
  | "ANALYTICS_PERMISSION_GRANTED"
  | "ANALYTICS_PERMISSION_REVOKED"
  | "ANALYTICS_STEPUP_SUCCESS"
  | "ANALYTICS_STEPUP_FAILED"
  | "ANALYTICS_QUERY_EXECUTED";

type AuditRecord = {
  id: string;
  actorId: string;
  action: string;
  metadata: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  correlationId?: string;
  tenantId: string;
  prevHash: string;
  hash: string;
};

// In-memory buffer (dev-only). In serverless, this resets between invocations.
// This is intentionally best-effort to keep build passing.
const memoryBuffer: AuditRecord[] = [];

function safeJson(v: unknown) {
  try {
    return JSON.stringify(v ?? {});
  } catch {
    return "{}";
  }
}

function makeId() {
  // small unique id without external deps
  return crypto.randomBytes(12).toString("hex");
}

/**
 * Log analytics audit event (best-effort; never throws)
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
    const last = memoryBuffer.length ? memoryBuffer[memoryBuffer.length - 1] : undefined;
    const prevHash = last?.hash ?? "";

    const createdAt = new Date();
    const hashInput = `${prevHash}${tenantId}${actorId}${action}${safeJson(
      metadata
    )}${createdAt.toISOString()}`;

    const hash = crypto.createHash("sha256").update(hashInput).digest("hex");

    const record: AuditRecord = {
      id: makeId(),
      tenantId,
      actorId,
      action,
      metadata: metadata ?? {},
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      createdAt,
      correlationId,
      prevHash,
      hash,
    };

    // keep a small rolling buffer to avoid memory bloat
    memoryBuffer.push(record);
    if (memoryBuffer.length > 2000) memoryBuffer.splice(0, memoryBuffer.length - 2000);

    // Also log to server output for traceability
    // (replace with a real DB write once schema exists)
    console.info("[AnalyticsAudit]", {
      tenantId,
      actorId,
      action,
      correlationId,
      ipAddress,
      userAgent,
      createdAt: createdAt.toISOString(),
      hash,
      prevHash,
    });
  } catch (error) {
    // Never fail the request if audit logging fails
    console.error("Failed to log analytics audit:", error);
  }
}

/**
 * Get analytics audit logs (Owner only)
 * Currently returns best-effort data from in-memory buffer.
 * In production, wire to a real Prisma model.
 */
export async function getAnalyticsAuditLogs(
  tenantId: string,
  startDate?: Date,
  endDate?: Date,
  action?: AnalyticsAuditAction,
  actorId?: string
): Promise<
  Array<{
    id: string;
    actorId: string;
    action: string;
    metadata: any;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
  }>
> {
  const logs = memoryBuffer
    .filter((l) => l.tenantId === tenantId)
    .filter((l) => l.action.startsWith("ANALYTICS_"))
    .filter((l) => (startDate ? l.createdAt >= startDate : true))
    .filter((l) => (endDate ? l.createdAt <= endDate : true))
    .filter((l) => (action ? l.action === action : true))
    .filter((l) => (actorId ? l.actorId === actorId : true))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 1000);

  return logs.map((log) => ({
    id: log.id,
    actorId: log.actorId,
    action: log.action,
    metadata: log.metadata,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt,
  }));
}
