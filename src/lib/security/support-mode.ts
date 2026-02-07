/**
 * Support Mode (Consent-based, Time-bound)
 * 
 * Allows owner to enable time-limited support access
 * Support can only view diagnostics (read-only)
 * Any write actions require maker-checker approval
 */

import { prisma } from "@/lib/prisma";
import { SupportSessionScope } from "@prisma/client";
import { requirePermission } from "./rbac";
import { logSecurityAudit } from "./audit";

const DEFAULT_SUPPORT_SESSION_MINUTES = 30;

/**
 * Enable support mode for a tenant
 * Requires SUPPORT_ACCESS permission (Owner only)
 */
export async function enableSupportMode(
  tenantId: string,
  enabledBy: string,
  scope: SupportSessionScope = "READ_ONLY",
  durationMinutes: number = DEFAULT_SUPPORT_SESSION_MINUTES
): Promise<{
  sessionId: string;
  expiresAt: Date;
}> {
  // Check permission
  await requirePermission(enabledBy, tenantId, "SUPPORT_ACCESS");

  // Get config for duration
  const config = await prisma.securityConfig.findUnique({
    where: { tenantId },
  });

  const sessionMinutes = config?.supportSessionMinutes || durationMinutes;
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + sessionMinutes);

  // Revoke any existing active sessions
  await prisma.supportSession.updateMany({
    where: {
      tenantId,
      isActive: true,
    },
    data: {
      isActive: false,
      revokedAt: new Date(),
    },
  });

  // Create new support session
  const session = await prisma.supportSession.create({
    data: {
      tenantId,
      enabledBy,
      scope,
      expiresAt,
      isActive: true,
    },
  });

  // Log to audit
  await logSecurityAudit(tenantId, enabledBy, "SUPPORT_ENABLED", {
    sessionId: session.id,
    scope,
    expiresAt: session.expiresAt,
  });

  return {
    sessionId: session.id,
    expiresAt: session.expiresAt,
  };
}

/**
 * Check if support mode is active for a tenant
 */
export async function isSupportModeActive(tenantId: string): Promise<{
  active: boolean;
  session?: {
    id: string;
    scope: SupportSessionScope;
    expiresAt: Date;
    enabledBy: string;
  };
}> {
  const now = new Date();

  const session = await prisma.supportSession.findFirst({
    where: {
      tenantId,
      isActive: true,
      expiresAt: {
        gt: now,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!session) {
    return { active: false };
  }

  return {
    active: true,
    session: {
      id: session.id,
      scope: session.scope,
      expiresAt: session.expiresAt,
      enabledBy: session.enabledBy,
    },
  };
}

/**
 * Revoke support mode
 * Owner can revoke their own support session
 */
export async function revokeSupportMode(
  tenantId: string,
  revokedBy: string
): Promise<void> {
  // Check permission
  await requirePermission(revokedBy, tenantId, "SUPPORT_ACCESS");

  // Revoke active sessions
  const result = await prisma.supportSession.updateMany({
    where: {
      tenantId,
      isActive: true,
    },
    data: {
      isActive: false,
      revokedAt: new Date(),
    },
  });

  if (result.count > 0) {
    // Log to audit
    await logSecurityAudit(tenantId, revokedBy, "SUPPORT_REVOKED", {
      revokedBy,
    });
  }
}

/**
 * Check if current user is support user in active session
 */
export async function isSupportUser(
  tenantId: string,
  userId: string
): Promise<boolean> {
  const supportStatus = await isSupportModeActive(tenantId);

  if (!supportStatus.active || !supportStatus.session) {
    return false;
  }

  // Check if user is the support user for this session
  const session = await prisma.supportSession.findUnique({
    where: { id: supportStatus.session.id },
  });

  return session?.supportUserId === userId;
}

/**
 * Log support access action
 */
export async function logSupportAction(
  tenantId: string,
  supportUserId: string,
  action: string,
  meta: Record<string, any> = {}
): Promise<void> {
  await logSecurityAudit(tenantId, supportUserId, "SUPPORT_VIEWED", {
    action,
    ...meta,
  });
}

/**
 * Request support action (for maker-checker)
 * Support users can request actions, but they require owner approval
 */
export async function requestSupportAction(
  tenantId: string,
  supportUserId: string,
  actionType: string,
  payload: Record<string, any>
): Promise<string> {
  // Verify support mode is active
  const supportStatus = await isSupportModeActive(tenantId);
  if (!supportStatus.active) {
    throw new Error("Support mode is not active");
  }

  // Verify user is support user
  const isSupport = await isSupportUser(tenantId, supportUserId);
  if (!isSupport) {
    throw new Error("User is not authorized as support");
  }

  // Create pending action (requires owner approval)
  const { createPendingAction } = await import("./maker-checker");
  const actionId = await createPendingAction(
    tenantId,
    `SUPPORT_${actionType}`,
    {
      ...payload,
      requestedBy: supportUserId,
      supportSessionId: supportStatus.session?.id,
    },
    supportUserId
  );

  // Log to audit
  await logSecurityAudit(tenantId, supportUserId, "SUPPORT_ACTION_REQUESTED", {
    actionId,
    actionType,
    payload,
  });

  return actionId;
}
