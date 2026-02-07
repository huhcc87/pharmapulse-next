/**
 * Maker-Checker Approval System (4-eyes principle)
 * 
 * Requires approval from a second person (OWNER/ADMIN) for sensitive actions
 * above configurable thresholds.
 */

import { prisma } from "@/lib/prisma";
import { PendingActionStatus } from "@prisma/client";
import { requirePermission } from "./rbac";
import { logSecurityAudit } from "./audit";
import { Permission } from "@prisma/client";

/**
 * Create a pending action requiring approval
 */
export async function createPendingAction(
  tenantId: string,
  actionType: string,
  payload: Record<string, any>,
  createdBy: string,
  expiresInHours: number = 24
): Promise<string> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);

  const pendingAction = await prisma.pendingAction.create({
    data: {
      tenantId,
      actionType,
      payloadJson: payload,
      createdBy,
      status: "PENDING",
      expiresAt,
    },
  });

  // Log to audit
  await logSecurityAudit(tenantId, createdBy, "PENDING_ACTION_CREATED", {
    actionId: pendingAction.id,
    actionType,
    payload,
  });

  return pendingAction.id;
}

/**
 * Approve a pending action
 * Requires APPROVE_ACTIONS permission
 */
export async function approvePendingAction(
  tenantId: string,
  actionId: string,
  approvedBy: string
): Promise<void> {
  // Check permission
  await requirePermission(approvedBy, tenantId, "APPROVE_ACTIONS");

  const action = await prisma.pendingAction.findUnique({
    where: { id: actionId },
  });

  if (!action) {
    throw new Error("Pending action not found");
  }

  if (action.tenantId !== tenantId) {
    throw new Error("Action belongs to different tenant");
  }

  if (action.status !== "PENDING") {
    throw new Error(`Action is already ${action.status}`);
  }

  if (action.expiresAt && action.expiresAt < new Date()) {
    // Mark as expired
    await prisma.pendingAction.update({
      where: { id: actionId },
      data: { status: "EXPIRED" },
    });
    throw new Error("Action has expired");
  }

  // Update status
  await prisma.pendingAction.update({
    where: { id: actionId },
    data: {
      status: "APPROVED",
      approvedBy,
      approvedAt: new Date(),
      executedAt: new Date(),
    },
  });

  // Log to audit
  await logSecurityAudit(tenantId, approvedBy, "PENDING_ACTION_APPROVED", {
    actionId,
    actionType: action.actionType,
    createdBy: action.createdBy,
  });

  // Execute the action (caller should handle execution logic)
  // The payload contains all information needed to execute
}

/**
 * Reject a pending action
 * Requires APPROVE_ACTIONS permission
 */
export async function rejectPendingAction(
  tenantId: string,
  actionId: string,
  rejectedBy: string,
  reason: string
): Promise<void> {
  // Check permission
  await requirePermission(rejectedBy, tenantId, "APPROVE_ACTIONS");

  const action = await prisma.pendingAction.findUnique({
    where: { id: actionId },
  });

  if (!action) {
    throw new Error("Pending action not found");
  }

  if (action.tenantId !== tenantId) {
    throw new Error("Action belongs to different tenant");
  }

  if (action.status !== "PENDING") {
    throw new Error(`Action is already ${action.status}`);
  }

  // Update status
  await prisma.pendingAction.update({
    where: { id: actionId },
    data: {
      status: "REJECTED",
      rejectedBy,
      rejectionReason: reason,
    },
  });

  // Log to audit
  await logSecurityAudit(tenantId, rejectedBy, "PENDING_ACTION_REJECTED", {
    actionId,
    actionType: action.actionType,
    createdBy: action.createdBy,
    reason,
  });
}

/**
 * Get pending actions for a tenant
 */
export async function getPendingActions(
  tenantId: string,
  options: {
    status?: PendingActionStatus;
    actionType?: string;
    createdBy?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{
  actions: any[];
  total: number;
}> {
  const {
    status,
    actionType,
    createdBy,
    limit = 50,
    offset = 0,
  } = options;

  const where: any = { tenantId };
  if (status) where.status = status;
  if (actionType) where.actionType = actionType;
  if (createdBy) where.createdBy = createdBy;

  const [actions, total] = await Promise.all([
    prisma.pendingAction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.pendingAction.count({ where }),
  ]);

  return { actions, total };
}

/**
 * Check if action requires approval based on thresholds
 */
export async function requiresApproval(
  tenantId: string,
  actionType: string,
  amount?: number
): Promise<boolean> {
  const config = await prisma.securityConfig.findUnique({
    where: { tenantId },
  });

  if (!config) {
    return false; // No config = no approval required
  }

  switch (actionType) {
    case "REFUND":
      return amount !== undefined && config.refundThreshold !== null
        ? amount > Number(config.refundThreshold)
        : false;
    case "DISCOUNT":
      return amount !== undefined && config.discountThreshold !== null
        ? amount > Number(config.discountThreshold)
        : false;
    default:
      return false;
  }
}
