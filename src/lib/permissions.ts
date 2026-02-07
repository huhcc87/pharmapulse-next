// Permission system for POS operations
export type PosRole = "OWNER" | "PHARMACIST" | "CASHIER" | "INTERN" | "TRAINEE";

export type PosAction =
  | "POS_CHECKOUT"
  | "POS_OVERRIDE_PRICE"
  | "POS_OVERRIDE_GST"
  | "POS_CHANGE_BATCH"
  | "POS_DISPENSE_SCHEDULE"
  | "POS_REPEAT_LAST_INVOICE"
  | "POS_MODIFY_CUSTOMER";

// Permission matrix: role -> actions allowed
const permissions: Record<PosRole, PosAction[]> = {
  OWNER: [
    "POS_CHECKOUT",
    "POS_OVERRIDE_PRICE",
    "POS_OVERRIDE_GST",
    "POS_CHANGE_BATCH",
    "POS_DISPENSE_SCHEDULE",
    "POS_REPEAT_LAST_INVOICE",
    "POS_MODIFY_CUSTOMER",
  ],
  PHARMACIST: [
    "POS_CHECKOUT",
    "POS_CHANGE_BATCH",
    "POS_DISPENSE_SCHEDULE",
    "POS_MODIFY_CUSTOMER",
  ],
  CASHIER: ["POS_CHECKOUT", "POS_MODIFY_CUSTOMER"],
  INTERN: [],
  TRAINEE: [],
};

/**
 * Check if a role can perform an action
 */
export function can(role: PosRole | string, action: PosAction): boolean {
  const normalizedRole = role.toUpperCase() as PosRole;
  const allowedActions = permissions[normalizedRole] || [];
  return allowedActions.includes(action);
}

/**
 * Get all allowed actions for a role
 */
export function getAllowedActions(role: PosRole | string): PosAction[] {
  const normalizedRole = role.toUpperCase() as PosRole;
  return permissions[normalizedRole] || [];
}

/**
 * Check if role can checkout schedule drugs (requires pharmacist/owner approval)
 */
export function canCheckoutSchedule(role: PosRole | string): boolean {
  return can(role, "POS_DISPENSE_SCHEDULE");
}

/**
 * Create permission error response
 */
export function createPermissionError(action: PosAction, role: PosRole | string) {
  return {
    code: "FORBIDDEN",
    action,
    message: `Role '${role}' is not permitted to perform action '${action}'`,
  };
}
