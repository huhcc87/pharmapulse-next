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
  const pool = await prisma.licensePool.create({
    data: {
      tenantId,
      name: data.name,
      description: data.description ?? null,
      totalLicenses: data.totalLicenses,
      allocatedLicenses: 0,
      availableLicenses: data.totalLicenses,
      autoAllocate: data.autoAllocate ?? false,
      allowTransfer: data.allowTransfer ?? true,
      isActive: true,
    },
  });

  return pool;
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
  // Check pool availability
  const pool = await prisma.licensePool.findUnique({
    where: { id: poolId },
    select: {
      id: true,
      availableLicenses: true,
      allocatedLicenses: true,
    },
  });

  if (!pool) throw new Error("License pool not found");
  if (pool.availableLicenses <= 0) throw new Error("No available licenses in pool");

  // Create allocation
  const allocation = await prisma.licenseAllocation.create({
    data: {
      poolId,
      licenseId: data.licenseId,
      allocatedTo: data.allocatedTo ?? null,
      expiresAt: data.expiresAt ?? null,
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
}

/**
 * Revoke license allocation
 */
export async function revokeLicenseAllocation(
  allocationId: string,
  reason?: string
): Promise<void> {
  // IMPORTANT: No `include: {}` here (it causes "never" error if no relations exist)
  const allocation = await prisma.licenseAllocation.findUnique({
    where: { id: allocationId },
    select: {
      id: true,
      poolId: true,
      status: true,
    },
  });

  if (!allocation) throw new Error("License allocation not found");

  // If already revoked, no-op
  if (allocation.status === "REVOKED") return;

  // Update allocation
  await prisma.licenseAllocation.update({
    where: { id: allocationId },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
      revocationReason: reason ?? null,
    },
  });

  // Update pool counters safely
  const pool = await prisma.licensePool.findUnique({
    where: { id: allocation.poolId },
    select: {
      id: true,
      allocatedLicenses: true,
      availableLicenses: true,
    },
  });

  if (!pool) return;

  await prisma.licensePool.update({
    where: { id: pool.id },
    data: {
      allocatedLicenses: Math.max(0, pool.allocatedLicenses - 1),
      availableLicenses: pool.availableLicenses + 1,
    },
  });
}

/**
 * Transfer license
 */
export async function transferLicense(
  fromAllocationId: string,
  toAllocatedTo: string
): Promise<any> {
  const allocation = await prisma.licenseAllocation.findUnique({
    where: { id: fromAllocationId },
    select: {
      id: true,
      poolId: true,
    },
  });

  if (!allocation) throw new Error("License allocation not found");

  // Check if transfer is allowed
  const pool = await prisma.licensePool.findUnique({
    where: { id: allocation.poolId },
    select: { allowTransfer: true },
  });

  if (!pool || !pool.allowTransfer) {
    throw new Error("License transfer not allowed for this pool");
  }

  // Update allocation
  const updated = await prisma.licenseAllocation.update({
    where: { id: fromAllocationId },
    data: { allocatedTo: toAllocatedTo },
  });

  return updated;
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
  const pool = await prisma.licensePool.findUnique({
    where: { id: poolId },
  });

  if (!pool) throw new Error("License pool not found");

  const allocations = await prisma.licenseAllocation.findMany({
    where: {
      poolId,
      status: "ACTIVE",
    },
    orderBy: { allocatedAt: "desc" },
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
}
