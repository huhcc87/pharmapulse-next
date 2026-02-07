// Multi-License Management API
// GET /api/licensing/pools - List license pools
// POST /api/licensing/pools - Create license pool

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import {
  createLicensePool,
  allocateLicense,
  revokeLicenseAllocation,
  transferLicense,
  getLicensePoolStatus,
} from "@/lib/licensing/multi-license";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const poolId = searchParams.get("poolId");
    const type = searchParams.get("type"); // list, status

    if (type === "status" && poolId) {
      const status = await getLicensePoolStatus(poolId);
      return NextResponse.json({ status });
    }

    const pools = await prisma.licensePool.findMany({
      where: {
        tenantId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      pools: pools.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        totalLicenses: p.totalLicenses,
        allocatedLicenses: p.allocatedLicenses,
        availableLicenses: p.availableLicenses,
        isActive: p.isActive,
        createdAt: p.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Get license pools API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { action, ...data } = body;

    const tenantId = user.tenantId || "default";

    if (action === "create") {
      const pool = await createLicensePool(tenantId, data);
      return NextResponse.json({
        success: true,
        pool: {
          id: pool.id,
          name: pool.name,
          totalLicenses: pool.totalLicenses,
        },
      });
    } else if (action === "allocate") {
      const allocation = await allocateLicense(data.poolId, {
        licenseId: data.licenseId,
        allocatedTo: data.allocatedTo,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      });
      return NextResponse.json({
        success: true,
        allocation: {
          id: allocation.id,
          licenseId: allocation.licenseId,
          allocatedTo: allocation.allocatedTo,
        },
      });
    } else if (action === "revoke") {
      await revokeLicenseAllocation(data.allocationId, data.reason);
      return NextResponse.json({
        success: true,
      });
    } else if (action === "transfer") {
      const allocation = await transferLicense(data.allocationId, data.toAllocatedTo);
      return NextResponse.json({
        success: true,
        allocation: {
          id: allocation.id,
          allocatedTo: allocation.allocatedTo,
        },
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("License pool API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
