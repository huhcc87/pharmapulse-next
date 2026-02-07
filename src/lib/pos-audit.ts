// Audit logging for POS operations
import { prisma } from "@/server/prisma";

export type PosAuditAction =
  | "POS_CHECKOUT"
  | "POS_OVERRIDE_PRICE"
  | "POS_OVERRIDE_GST"
  | "POS_CHANGE_BATCH"
  | "POS_DISPENSE_SCHEDULE"
  | "POS_REPEAT_LAST_INVOICE";

export interface PosAuditPayload {
  productId?: number;
  drugLibraryId?: number;
  batchId?: number;
  oldValue?: any;
  newValue?: any;
  invoiceId?: number;
  [key: string]: any;
}

/**
 * Log a POS action to audit log
 */
export async function logPosAction(
  action: PosAuditAction,
  userId: number,
  tenantId: number,
  branchId: number | null = null,
  payload?: PosAuditPayload
) {
  try {
    await prisma.posAuditLog.create({
      data: {
        tenantId,
        branchId,
        userId,
        action,
        payload: payload ? (payload as any) : null,
      },
    });
  } catch (error) {
    // Log error but don't fail the operation
    console.error("Failed to log POS action:", error);
  }
}
