// Multi-License Management
// License pools, allocation, transfer

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface LicensePoolData {
  name: string;
  description?: string;
  totalLicenses: number;
  autoAllocate?: boolean;
  allowTransfer?: boolean;
}

export interface LicenseAllocationData {
  poolId: string;
  licenseId: string;
  allocatedTo?: string;
  expiresAt?: Date;
}

/**
 * Create license pool
 */
export async function createLicensePool(
  tenantId: string,
  data: LicensePoolData
): Promise<any> {
  try {
    const pool = await prisma.licensePool.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description || null,
        totalLicenses: data.totalLicenses,
        allocatedLicenses: 0,
        availableLicenses: data.totalLicenses,
        autoAllocate: data.autoAllocate || false,
        allowTransfer: data.allowTransfer !== false,
        isActive: true,
      },
    });

    return pool;
  } catch (error: any) {
    console.error("Create license pool error:", error);
    throw error;
  }
}

/**
 * Allocate license from pool
 */
export async function allocateLicense(
  poolId: string,
  data: {
    licenseId: string;
    allocatedTo?: string;
    expiresAt?: Date;
  }
): Promise<any> {
  try {
    // Check pool availability
    const pool = await prisma.licensePool.findUnique({
      where: { id: poolId },
    });

    if (!pool) {
      throw new Error("License pool not found");
    }

    if (pool.availableLicenses <= 0) {
      throw new Error("No available licenses in pool");
    }

    // Create allocation
    const allocation = await prisma.licenseAllocation.create({
      data: {
        poolId,
        licenseId: data.licenseId,
        allocatedTo: data.allocatedTo || null,
        expiresAt: data.expiresAt || null,
        status: "ACTIVE",
      },
    });

    // Update pool
    await prisma.licensePool.update({
      where: { id: poolId },
      data: {
        allocatedLicenses: pool.allocatedLicenses + 1,
        availableLicenses: pool.availableLicenses - 1,
      },
    });

    return allocation;
  } catch (error: any) {
    console.error("Allocate license error:", error);
    throw error;
  }
}

/**
 * Revoke license allocation
 */
export async function revokeLicenseAllocation(
  allocationId: string,
  reason?: string
): Promise<void> {
  try {
    const allocation = await prisma.licenseAllocation.findUnique({
      where: { id: allocationId },
      include: {
        // Note: Would need relation in schema
      },
    });

    if (!allocation) {
      throw new Error("License allocation not found");
    }

    // Update allocation
    await prisma.licenseAllocation.update({
      where: { id: allocationId },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revocationReason: reason || null,
      },
    });

    // Update pool
    const pool = await prisma.licensePool.findUnique({
      where: { id: allocation.poolId },
    });

    if (pool) {
      await prisma.licensePool.update({
        where: { id: pool.id },
        data: {
          allocatedLicenses: Math.max(0, pool.allocatedLicenses - 1),
          availableLicenses: pool.availableLicenses + 1,
        },
      });
    }
  } catch (error: any) {
    console.error("Revoke license allocation error:", error);
    throw error;
  }
}

/**
 * Transfer license
 */
export async function transferLicense(
  fromAllocationId: string,
  toAllocatedTo: string
): Promise<any> {
  try {
    const allocation = await prisma.licenseAllocation.findUnique({
      where: { id: fromAllocationId },
    });

    if (!allocation) {
      throw new Error("License allocation not found");
    }

    // Check if transfer is allowed
    const pool = await prisma.licensePool.findUnique({
      where: { id: allocation.poolId },
    });

    if (!pool || !pool.allowTransfer) {
      throw new Error("License transfer not allowed for this pool");
    }

    // Update allocation
    const updated = await prisma.licenseAllocation.update({
      where: { id: fromAllocationId },
      data: {
        allocatedTo: toAllocatedTo,
      },
    });

    return updated;
  } catch (error: any) {
    console.error("Transfer license error:", error);
    throw error;
  }
}

/**
 * Get license pool status
 */
export async function getLicensePoolStatus(
  poolId: string
): Promise<{
  totalLicenses: number;
  allocatedLicenses: number;
  availableLicenses: number;
  allocations: any[];
}> {
  try {
    const pool = await prisma.licensePool.findUnique({
      where: { id: poolId },
    });

    if (!pool) {
      throw new Error("License pool not found");
    }

    const allocations = await prisma.licenseAllocation.findMany({
      where: {
        poolId,
        status: "ACTIVE",
      },
    });

    return {
      totalLicenses: pool.totalLicenses,
      allocatedLicenses: pool.allocatedLicenses,
      availableLicenses: pool.availableLicenses,
      allocations: allocations.map((a) => ({
        id: a.id,
        licenseId: a.licenseId,
        allocatedTo: a.allocatedTo,
        allocatedAt: a.allocatedAt,
        expiresAt: a.expiresAt,
      })),
    };
  } catch (error: any) {
    console.error("Get license pool status error:", error);
    throw error;
  }
}
