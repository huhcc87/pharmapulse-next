/**
 * Grace Period Management
 * 
 * Handles grace period after licence expiry, allowing
 * limited access during the grace period before full lockout.
 */

import { prisma } from "@/lib/prisma";
import { getDaysRemaining } from "./licence-utils";

export interface GracePeriodStatus {
  inGrace: boolean;
  graceUntil: Date | null;
  daysRemaining: number | null;
  expired: boolean;
  daysInGrace: number | null;
}

/**
 * Check grace period status for a licence
 */
export async function checkGracePeriod(
  licence: any
): Promise<GracePeriodStatus> {
  if (!licence.expiresAt) {
    return { 
      inGrace: false, 
      graceUntil: null, 
      daysRemaining: null, 
      expired: false,
      daysInGrace: null,
    };
  }

  const now = new Date();
  const expiryDate = new Date(licence.expiresAt);
  const gracePeriodDays = licence.gracePeriodDays || 7;
  const graceUntil = new Date(expiryDate);
  graceUntil.setDate(graceUntil.getDate() + gracePeriodDays);

  const expired = now > expiryDate;
  const inGrace = expired && now <= graceUntil;
  
  let daysRemaining: number | null = null;
  let daysInGrace: number | null = null;

  if (inGrace) {
    daysInGrace = Math.ceil((graceUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    daysRemaining = daysInGrace;
  } else if (!expired) {
    daysRemaining = getDaysRemaining(expiryDate);
  } else {
    daysRemaining = 0;
  }

  // Update graceUntil if in grace and not set
  if (inGrace && !licence.graceUntil) {
    await prisma.license.update({
      where: { id: licence.id },
      data: { graceUntil },
    });
  }

  return { 
    inGrace, 
    graceUntil: inGrace ? graceUntil : null, 
    daysRemaining, 
    expired,
    daysInGrace,
  };
}

/**
 * Calculate grace until date
 */
export function calculateGraceUntil(expiresAt: Date | null, gracePeriodDays: number = 7): Date | null {
  if (!expiresAt) return null;
  const graceUntil = new Date(expiresAt);
  graceUntil.setDate(graceUntil.getDate() + gracePeriodDays);
  return graceUntil;
}

/**
 * Check if licence is in grace period
 */
export function isInGracePeriod(expiresAt: Date | null, graceUntil: Date | null): boolean {
  if (!expiresAt || !graceUntil) return false;
  const now = new Date();
  return now > expiresAt && now <= graceUntil;
}
