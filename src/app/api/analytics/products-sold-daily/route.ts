/**
 * Single implementation that we alias under TWO DIFFERENT export names
 */
async function _verifyAnalyticsUnlock(
  tokenOrArgs:
    | string
    | { token: string; tenantId: string | number; userId: string },
  tenantIdMaybe?: string | number,
  userIdMaybe?: string
): Promise<boolean> {
  let token: string | undefined;
  let tenantId: string | number | undefined;
  let userId: string | undefined;

  if (typeof tokenOrArgs === "string") {
    token = tokenOrArgs;
    tenantId = tenantIdMaybe;
    userId = userIdMaybe;
  } else {
    token = tokenOrArgs.token;
    tenantId = tokenOrArgs.tenantId;
    userId = tokenOrArgs.userId;
  }

  if (!token) return false;
  if (tenantId === undefined || tenantId === null) return false;
  if (!userId) return false;

  // IMPORTANT: keep your existing logic here (example below)
  return isAnalyticsUnlocked(String(tenantId), userId);
}

/** ✅ Name used by products-sold-daily route */
export const verifyAnalyticsUnlockToken = _verifyAnalyticsUnlock;

/** ✅ Backward-compat export name used by older stepup routes (must be DIFFERENT) */
export const verifyAnalyticsUnlock = _verifyAnalyticsUnlock;
