// IP Whitelisting API
// GET /api/security/ip/whitelist - List whitelisted IPs
// POST /api/security/ip/whitelist - Add IP to whitelist

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { addIpToWhitelist, isIpWhitelisted } from "@/lib/security/ip-geo-blocking";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";

    const whitelists = await prisma.ipWhitelist.findMany({
      where: {
        tenantId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      whitelists: whitelists.map((w) => ({
        id: w.id,
        ipAddress: w.ipAddress,
        description: w.description,
        isActive: w.isActive,
        createdAt: w.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Get IP whitelist API error:", error);
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
    const { ipAddress, description } = body;

    if (!ipAddress) {
      return NextResponse.json(
        { error: "ipAddress is required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";

    const whitelist = await addIpToWhitelist(tenantId, {
      ipAddress,
      description,
    });

    return NextResponse.json({
      success: true,
      whitelist: {
        id: whitelist.id,
        ipAddress: whitelist.ipAddress,
        description: whitelist.description,
      },
    });
  } catch (error: any) {
    console.error("Add IP to whitelist API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
