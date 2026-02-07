/**
 * Role-Based Access Control (RBAC) Guards
 * 
 * Server-side permission and role checking for API routes.
 * All checks are enforced server-side - client UI is not trusted.
 */

import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { Permission, SystemRole } from "@prisma/client";

export interface UserWithRoles {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
  permissions: Permission[];
  roles: SystemRole[];
}

/**
 * Get user's roles and permissions for a tenant
 */
export async function getUserPermissions(
  userId: string,
  tenantId: string
): Promise<UserWithRoles> {
  // Get user roles for this tenant
  const userRoles = await prisma.userRole.findMany({
    where: {
      tenantId,
      userId,
    },
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

  // Collect all permissions
  const permissions = new Set<Permission>();
  const roles = new Set<SystemRole>();

  for (const userRole of userRoles) {
    roles.add(userRole.role.name as SystemRole);
    for (const rp of userRole.role.permissions) {
      permissions.add(rp.permission.name as Permission);
    }
  }

  // Get base user info
  const user = await getSessionUser();
  if (!user) {
    throw new Error("User not found");
  }

  // If no roles assigned, assign default role based on user's role from auth
  // This is a fallback for development/testing
  if (roles.size === 0) {
    // Map auth role to system role
    let defaultSystemRole: SystemRole = "CASHIER";
    if (user.role === "owner" || user.role === "super_admin") {
      defaultSystemRole = "OWNER";
    }

    // Try to get the role
    const role = await prisma.role.findUnique({
      where: { name: defaultSystemRole },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (role) {
      roles.add(role.name as SystemRole);
      for (const rp of role.permissions) {
        permissions.add(rp.permission.name as Permission);
      }

      // Auto-assign role for future requests (development convenience)
      if (process.env.NODE_ENV === "development") {
        try {
          await prisma.userRole.upsert({
            where: {
              tenantId_userId_roleId: {
                tenantId,
                userId,
                roleId: role.id,
              },
            },
            create: {
              tenantId,
              userId,
              roleId: role.id,
              assignedBy: userId,
            },
            update: {},
          });
        } catch (error) {
          // Ignore errors in auto-assignment
          console.warn("Failed to auto-assign role:", error);
        }
      }
    }
  }

  return {
    userId,
    tenantId,
    email: user.email,
    role: user.role,
    permissions: Array.from(permissions),
    roles: Array.from(roles),
  };
}

/**
 * Require user to have a specific role
 * Throws error if user doesn't have the role
 */
export async function requireRole(
  userId: string,
  tenantId: string,
  requiredRole: SystemRole
): Promise<void> {
  const userWithRoles = await getUserPermissions(userId, tenantId);

  if (!userWithRoles.roles.includes(requiredRole)) {
    const err = new Error(`Required role: ${requiredRole}`);
    // @ts-ignore
    err.status = 403;
    // @ts-ignore
    err.code = "ROLE_REQUIRED";
    throw err;
  }
}

/**
 * Require user to have a specific permission
 * Throws error if user doesn't have the permission
 */
export async function requirePermission(
  userId: string,
  tenantId: string,
  requiredPermission: Permission
): Promise<void> {
  const userWithRoles = await getUserPermissions(userId, tenantId);

  if (!userWithRoles.permissions.includes(requiredPermission)) {
    const err = new Error(`Required permission: ${requiredPermission}`);
    // @ts-ignore
    err.status = 403;
    // @ts-ignore
    err.code = "PERMISSION_REQUIRED";
    throw err;
  }
}

/**
 * Check if user has a specific permission (returns boolean)
 */
export async function hasPermission(
  userId: string,
  tenantId: string,
  permission: Permission
): Promise<boolean> {
  try {
    await requirePermission(userId, tenantId, permission);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if user has a specific role (returns boolean)
 */
export async function hasRole(
  userId: string,
  tenantId: string,
  role: SystemRole
): Promise<boolean> {
  try {
    await requireRole(userId, tenantId, role);
    return true;
  } catch {
    return false;
  }
}

/**
 * Middleware helper: Get authenticated user with permissions
 * Use this in API routes to get user with full RBAC context
 */
export async function getAuthenticatedUserWithPermissions(): Promise<UserWithRoles> {
  const user = await getSessionUser();
  requireAuth(user);

  return await getUserPermissions(user.userId, user.tenantId);
}

/**
 * Assign role to user (for user management)
 * Requires USER_MANAGE permission
 */
export async function assignRoleToUser(
  tenantId: string,
  targetUserId: string,
  roleName: SystemRole,
  assignedByUserId: string
): Promise<void> {
  // Check permission
  await requirePermission(assignedByUserId, tenantId, "USER_MANAGE");

  // Get role
  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    throw new Error(`Role not found: ${roleName}`);
  }

  // Assign role
  await prisma.userRole.upsert({
    where: {
      tenantId_userId_roleId: {
        tenantId,
        userId: targetUserId,
        roleId: role.id,
      },
    },
    create: {
      tenantId,
      userId: targetUserId,
      roleId: role.id,
      assignedBy: assignedByUserId,
    },
    update: {
      assignedBy: assignedByUserId,
      updatedAt: new Date(),
    },
  });
}

/**
 * Remove role from user
 * Requires USER_MANAGE permission
 */
export async function removeRoleFromUser(
  tenantId: string,
  targetUserId: string,
  roleName: SystemRole,
  removedByUserId: string
): Promise<void> {
  // Check permission
  await requirePermission(removedByUserId, tenantId, "USER_MANAGE");

  // Get role
  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    throw new Error(`Role not found: ${roleName}`);
  }

  // Remove role
  await prisma.userRole.deleteMany({
    where: {
      tenantId,
      userId: targetUserId,
      roleId: role.id,
    },
  });
}
