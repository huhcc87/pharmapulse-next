/**
 * Analytics Permission Management
 *
 * RBAC + per-user grants for Analytics access.
 * Owner has ANALYTICS_VIEW by default.
 * Other users must be explicitly granted by Owner.
 */

import { prisma } from "@/lib/prisma";

export type AnalyticsPermission =
  | "ANALYTICS_VIEW"
  | "ANALYTICS_VIEW_REVENUE"
  | "ANALYTICS_VIEW_SALES"
  | "ANALYTICS_VIEW_PRODUCTS"
  | "ANALYTICS_EXPORT";

/**
 * Check if user has analytics permission
 * Checks: role permissions → user permissions
 */
export async function hasAnalyticsPermission(
  tenantId: string,
  userId: string,
  permission: AnalyticsPermission
): Promise<boolean> {
  // NOTE: In your schema Role relation is "permissions" (not "rolePermissions")
  const userRoles = await prisma.userRole.findMany({
    where: { tenantId, userId },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  // Check role permissions
  for (const userRole of userRoles) {
    if (userRole.role?.name === "OWNER") return true;

    for (const rp of userRole.role?.permissions ?? []) {
      if (rp.permission?.name === permission) return true;
    }
  }

  // Check user-specific permissions (granted by Owner)
  const userPermission = await prisma.userPermission.findFirst({
    where: {
      tenantId,
      userId,
      permission: {
        name: permission,
      },
      revokedAt: null,
    },
  });

  return userPermission !== null;
}

/**
 * Require analytics permission (throws if not granted)
 */
export async function requireAnalyticsPermission(
  tenantId: string,
  userId: string,
  permission: AnalyticsPermission
): Promise<void> {
  const ok = await hasAnalyticsPermission(tenantId, userId, permission);
  if (!ok) {
    throw new Error(`Permission ${permission} required. Request access from Owner.`);
  }
}

/**
 * Grant analytics permission to user (Owner only)
 */
export async function grantAnalyticsPermission(
  tenantId: string,
  userId: string,
  permission: AnalyticsPermission,
  grantedBy: string
): Promise<void> {
  const permissionDef = await prisma.permissionDef.findUnique({
    where: { name: permission },
  });

  if (!permissionDef) throw new Error(`Permission ${permission} not found`);

  await prisma.userPermission.upsert({
    where: {
      tenantId_userId_permissionId: {
        tenantId,
        userId,
        permissionId: permissionDef.id,
      },
    },
    create: {
      tenantId,
      userId,
      permissionId: permissionDef.id,
      grantedBy,
    },
    update: {
      revokedAt: null,
      revokedBy: null,
    },
  });
}

/**
 * Revoke analytics permission from user (Owner only)
 */
export async function revokeAnalyticsPermission(
  tenantId: string,
  userId: string,
  permission: AnalyticsPermission,
  revokedBy: string
): Promise<void> {
  const permissionDef = await prisma.permissionDef.findUnique({
    where: { name: permission },
  });

  if (!permissionDef) throw new Error(`Permission ${permission} not found`);

  await prisma.userPermission.updateMany({
    where: {
      tenantId,
      userId,
      permissionId: permissionDef.id,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokedBy,
    },
  });
}

/**
 * Get all analytics permissions for a user
 */
export async function getUserAnalyticsPermissions(
  tenantId: string,
  userId: string
): Promise<Set<AnalyticsPermission>> {
  const permissions = new Set<AnalyticsPermission>();

  const userRoles = await prisma.userRole.findMany({
    where: { tenantId, userId },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  const isOwner = userRoles.some((ur) => ur.role?.name === "OWNER");
  if (isOwner) {
    return new Set<AnalyticsPermission>([
      "ANALYTICS_VIEW",
      "ANALYTICS_VIEW_REVENUE",
      "ANALYTICS_VIEW_SALES",
      "ANALYTICS_VIEW_PRODUCTS",
      "ANALYTICS_EXPORT",
    ]);
  }

  // Role-based permissions
  for (const ur of userRoles) {
    for (const rp of ur.role?.permissions ?? []) {
      const name = rp.permission?.name;
      if (typeof name === "string" && name.startsWith("ANALYTICS_")) {
        permissions.add(name as AnalyticsPermission);
      }
    }
  }

  // User-specific permissions
  const userPerms = await prisma.userPermission.findMany({
    where: { tenantId, userId, revokedAt: null },
    include: { permission: true },
  });

  for (const up of userPerms) {
    const name = up.permission?.name;
    if (typeof name === "string" && name.startsWith("ANALYTICS_")) {
      permissions.add(name as AnalyticsPermission);
    }
  }

  return permissions;
}

/**
 * Get all users with their analytics permissions (for Owner UI)
 */
export async function getUsersWithAnalyticsPermissions(
  tenantId: string
): Promise<
  Array<{
    userId: string;
    email: string;
    name: string;
    roles: string[];
    permissions: AnalyticsPermission[];
    grantedBy?: string;
    grantedAt?: Date;
  }>
> {
  const userRoles = await prisma.userRole.findMany({
    where: { tenantId },
    include: { role: true },
  });

  const userIds = Array.from(new Set(userRoles.map((ur) => ur.userId)));
  const result: Array<{
    userId: string;
    email: string;
    name: string;
    roles: string[];
    permissions: AnalyticsPermission[];
    grantedBy?: string;
    grantedAt?: Date;
  }> = [];

  for (const userId of userIds) {
    const roles = userRoles
      .filter((ur) => ur.userId === userId)
      .map((ur) => ur.role?.name)
      .filter(Boolean) as string[];

    const perms = await getUserAnalyticsPermissions(tenantId, userId);

    const userPerms = await prisma.userPermission.findMany({
      where: { tenantId, userId, revokedAt: null },
      include: { permission: true },
      orderBy: { createdAt: "desc" },
    });

    result.push({
      userId,
      email: `user-${userId}@pharmapulse.com`, // TODO: replace with real User table
      name: `User ${userId}`, // TODO: replace with real User table
      roles,
      permissions: Array.from(perms),
      grantedBy: userPerms[0]?.grantedBy,
      grantedAt: userPerms[0]?.createdAt,
    });
  }

  return result;
}
