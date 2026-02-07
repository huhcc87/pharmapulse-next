// src/lib/auth/context.ts
import { headers } from "next/headers";

export async function getTenantContext() {
  const h = await headers();

  // For now: allow passing tenantId via header (later replace with real auth)
  const tenantIdHeader = h.get("x-tenant-id");
  const tenantId = tenantIdHeader ? parseInt(tenantIdHeader, 10) : 1;

  const userIdHeader = h.get("x-user-id");
  const userId = userIdHeader ? parseInt(userIdHeader, 10) : null;

  const branchIdHeader = h.get("x-branch-id");
  const branchId = branchIdHeader ? parseInt(branchIdHeader, 10) : null;

  return { tenantId, userId, branchId };
}
