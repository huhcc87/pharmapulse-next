/**
 * Read-Only Mode Enforcement
 * 
 * Determines access level based on licence status and grace period.
 * Prevents write operations when licence is expired (outside grace).
 */

export enum AccessLevel {
  FULL = "full",
  READ_ONLY = "read_only",
  BLOCKED = "blocked",
}

export interface LicenceAccessResult {
  accessLevel: AccessLevel;
  reason?: string;
  gracePeriod?: boolean;
  daysRemaining?: number | null;
}

/**
 * Determine access level based on licence status
 */
export function determineAccessLevel(
  status: string,
  expired: boolean,
  inGrace: boolean,
  graceDaysRemaining?: number | null
): LicenceAccessResult {
  if (status === "active" && !expired) {
    return { accessLevel: AccessLevel.FULL };
  }

  if (status === "suspended") {
    return { 
      accessLevel: AccessLevel.BLOCKED,
      reason: "Licence has been suspended. Please contact support."
    };
  }

  if (status === "expired" && expired && inGrace) {
    return { 
      accessLevel: AccessLevel.READ_ONLY,
      gracePeriod: true,
      daysRemaining: graceDaysRemaining || null,
      reason: `Licence expired. In grace period (${graceDaysRemaining || 0} days remaining). Please renew to restore full access.`
    };
  }

  if (status === "expired" && expired && !inGrace) {
    return { 
      accessLevel: AccessLevel.READ_ONLY,
      gracePeriod: false,
      reason: "Licence expired. Read-only access only. Please renew to restore full access."
    };
  }

  if (status === "pending_renewal") {
    return { 
      accessLevel: AccessLevel.READ_ONLY,
      reason: "Licence is pending renewal. Read-only access only."
    };
  }

  return { 
    accessLevel: AccessLevel.FULL,
  };
}

/**
 * Check if HTTP method is a write operation
 */
export function isWriteOperation(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

/**
 * Check if route should be blocked in read-only mode
 */
export function isBlockedRoute(path: string): boolean {
  // Routes that should be blocked in read-only mode
  const blockedRoutes = [
    "/api/pos/",
    "/api/billing/",
    "/api/inventory/stock",
    "/api/reports/export",
    "/api/sales/",
  ];
  
  return blockedRoutes.some(route => path.startsWith(route));
}

/**
 * Check if route should allow read-only access
 */
export function isReadOnlyAllowedRoute(path: string): boolean {
  // Routes that should be allowed in read-only mode
  const allowedRoutes = [
    "/api/inventory/",
    "/api/invoices/",
    "/api/reports/view",
    "/api/products/",
  ];
  
  return allowedRoutes.some(route => path.startsWith(route)) && !isWriteOperation(path);
}
