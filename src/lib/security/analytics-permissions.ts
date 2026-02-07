/**
 * Analytics Permission Management
 * 
 * RBAC + per-user grants for Analytics access.
 * Owner has ANALYTICS_VIEW by default.
 * Other users must be explicitly granted by Owner.
 */

import { prisma } from "@/lib/prisma";
import { Permission } from "@prisma/client";

export type AnalyticsPermission = 
  | 'ANALYTICS_VIEW'
  | 'ANALYTICS_VIEW_REVENUE'
  | 'ANALYTICS_VIEW_SALES'
  | 'ANALYTICS_VIEW_PRODUCTS'
  | 'ANALYTICS_EXPORT';

/**
 * Check if user has analytics permission
 * Checks: role permissions → user permissions
 */
export async function hasAnalyticsPermission(
  tenantId: string,
  userId: string,
  permission: AnalyticsPermission
): Promise<boolean> {
  // Check if user is OWNER (has all analytics permissions by default)
  const userRoles = await prisma.userRole.findMany({
    where: {
      tenantId,
      userId,
    },
    include: {
      role: {
        include: {
          rolePermissions: {
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
    if (userRole.role.name === 'OWNER') {
      // Owner has all permissions
      return true;
    }

    for (const rp of userRole.role.rolePermissions) {
      if (rp.permission.name === permission) {
        return true;
      }
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
  const hasPermission = await hasAnalyticsPermission(tenantId, userId, permission);
  if (!hasPermission) {
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
  // Get permission ID
  const permissionDef = await prisma.permissionDef.findUnique({
    where: { name: permission },
  });

  if (!permissionDef) {
    throw new Error(`Permission ${permission} not found`);
  }

  // Grant permission
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

  if (!permissionDef) {
    throw new Error(`Permission ${permission} not found`);
  }

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

  // Check if OWNER
  const userRoles = await prisma.userRole.findMany({
    where: { tenantId, userId },
    include: { role: true },
  });

  const isOwner = userRoles.some(ur => ur.role.name === 'OWNER');

  if (isOwner) {
    // Owner has all permissions
    return new Set([
      'ANALYTICS_VIEW',
      'ANALYTICS_VIEW_REVENUE',
      'ANALYTICS_VIEW_SALES',
      'ANALYTICS_VIEW_PRODUCTS',
      'ANALYTICS_EXPORT',
    ]);
  }

  // Check role permissions
  for (const userRole of userRoles) {
    const rolePerms = await prisma.rolePermission.findMany({
      where: { roleId: userRole.roleId },
      include: { permission: true },
    });

    for (const rp of rolePerms) {
      if (rp.permission.name.startsWith('ANALYTICS_')) {
        permissions.add(rp.permission.name as AnalyticsPermission);
      }
    }
  }

  // Check user-specific permissions
  const userPerms = await prisma.userPermission.findMany({
    where: {
      tenantId,
      userId,
      revokedAt: null,
    },
    include: { permission: true },
  });

  for (const up of userPerms) {
    if (up.permission.name.startsWith('ANALYTICS_')) {
      permissions.add(up.permission.name as AnalyticsPermission);
    }
  }

  return permissions;
}

/**
 * Get all users with their analytics permissions (for Owner UI)
 */
export async function getUsersWithAnalyticsPermissions(
  tenantId: string
): Promise<Array<{
  userId: string;
  email: string;
  name: string;
  roles: string[];
  permissions: AnalyticsPermission[];
  grantedBy?: string;
  grantedAt?: Date;
}>> {
  // Get all users in tenant (you'll need to adapt this to your User model)
  // For now, we'll get from user_roles
  const userRoles = await prisma.userRole.findMany({
    where: { tenantId },
    include: {
      role: true,
    },
  });

  const userIds = new Set(userRoles.map(ur => ur.userId));
  const result: Array<any> = [];

  for (const userId of userIds) {
    const roles = userRoles
      .filter(ur => ur.userId === userId)
      .map(ur => ur.role.name);

    const permissions = await getUserAnalyticsPermissions(tenantId, userId);

    // Get grant info for user permissions
    const userPerms = await prisma.userPermission.findMany({
      where: {
        tenantId,
        userId,
        revokedAt: null,
      },
      include: { permission: true },
      orderBy: { createdAt: 'desc' },
    });

    const grantedBy = userPerms[0]?.grantedBy;
    const grantedAt = userPerms[0]?.createdAt;

    result.push({
      userId,
      email: `user-${userId}@pharmapulse.com`, // Adapt to your User model
      name: `User ${userId}`, // Adapt to your User model
      roles,
      permissions: Array.from(permissions),
      grantedBy,
      grantedAt,
    });
  }

  return result;
}
