// Stock health indicators for inventory
import { getExpiryWarning } from "./fefo";

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
export type ExpiryStatus = "SAFE" | "NEAR" | "SOON" | "CRITICAL" | "EXPIRED";

export interface StockIndicator {
  status: StockStatus;
  quantity: number;
  lowStockThreshold: number;
  message: string;
}

export interface ExpiryIndicator {
  status: ExpiryStatus;
  daysToExpiry: number | null;
  message: string;
}

export interface InventoryHealth {
  stock: StockIndicator;
  expiry: ExpiryIndicator | null;
  needsAttention: boolean;
}

/**
 * Determine stock status
 */
export function getStockStatus(
  quantity: number,
  lowStockThreshold: number = 5
): StockIndicator {
  if (quantity === 0) {
    return {
      status: "OUT_OF_STOCK",
      quantity: 0,
      lowStockThreshold,
      message: "Out of stock",
    };
  }

  if (quantity <= lowStockThreshold) {
    return {
      status: "LOW_STOCK",
      quantity,
      lowStockThreshold,
      message: `Low stock (${quantity} remaining)`,
    };
  }

  return {
    status: "IN_STOCK",
    quantity,
    lowStockThreshold,
    message: "In stock",
  };
}

/**
 * Get expiry indicator for batch
 */
export function getExpiryIndicator(
  expiryDate: Date | null
): ExpiryIndicator | null {
  if (!expiryDate) return null;

  const warning = getExpiryWarning(expiryDate);
  return {
    status: warning.level,
    daysToExpiry: warning.days,
    message: warning.message,
  };
}

/**
 * Get combined inventory health
 */
export function getInventoryHealth(
  quantity: number,
  expiryDate: Date | null,
  lowStockThreshold: number = 5
): InventoryHealth {
  const stock = getStockStatus(quantity, lowStockThreshold);
  const expiry = getExpiryIndicator(expiryDate);

  // ✅ Always boolean (no boolean|null)
  const needsAttention =
    stock.status === "OUT_OF_STOCK" ||
    stock.status === "LOW_STOCK" ||
    expiry?.status === "CRITICAL" ||
    expiry?.status === "EXPIRED";

  return {
    stock,
    expiry,
    needsAttention,
  };
}

/**
 * Get stock indicator emoji/icon
 */
export function getStockIcon(status: StockStatus): string {
  switch (status) {
    case "IN_STOCK":
      return "🟢";
    case "LOW_STOCK":
      return "🟡";
    case "OUT_OF_STOCK":
      return "🔴";
    default:
      return "🟢";
  }
}

/**
 * Get expiry indicator emoji/icon
 */
export function getExpiryIcon(status: ExpiryStatus): string {
  switch (status) {
    case "SAFE":
      return "";
    case "NEAR":
      return "⏰";
    case "SOON":
      return "⚠️";
    case "CRITICAL":
      return "🚨";
    case "EXPIRED":
      return "❌";
    default:
      return "";
  }
}
