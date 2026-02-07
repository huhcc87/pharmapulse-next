/**
 * Mobile App Statistics API
 * 
 * GET: Get current app statistics
 * PUT: Update app statistics (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { z } from "zod";

const updateStatsSchema = z.object({
  activeUsers: z.number().int().min(0).optional(),
  appRating: z.number().min(0).max(5).optional(),
  totalDownloads: z.number().int().min(0).optional(),
  uptimePercent: z.number().min(0).max(100).optional(),
});

// GET /api/mobile/stats - Get app statistics
export async function GET(request: NextRequest) {
  try {
    // Get or create stats (singleton)
    let stats = await prisma.appStats.findFirst({
      orderBy: { createdAt: "desc" },
    });

    // If no stats exist, create default empty stats
    if (!stats) {
      stats = await prisma.appStats.create({
        data: {
          activeUsers: 0,
          appRating: null,
          totalDownloads: 0,
          uptimePercent: null,
        },
      });
    }

    return NextResponse.json({
      activeUsers: stats.activeUsers,
      appRating: stats.appRating ? Number(stats.appRating) : null,
      totalDownloads: stats.totalDownloads,
      uptimePercent: stats.uptimePercent ? Number(stats.uptimePercent) : null,
      lastUpdated: stats.lastUpdated,
    });
  } catch (error: any) {
    console.error("Failed to get app stats:", error);
    return NextResponse.json(
      { error: "Failed to get app statistics" },
      { status: 500 }
    );
  }
}

// PUT /api/mobile/stats - Update app statistics (admin only)
export async function PUT(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    // Only owner/admin can update stats
    if (user.role !== "owner" && user.role !== "super_admin") {
      return NextResponse.json(
        { error: "Only owner/admin can update app statistics" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updates = updateStatsSchema.parse(body);

    // Get or create stats
    let stats = await prisma.appStats.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!stats) {
      stats = await prisma.appStats.create({
        data: {
          activeUsers: updates.activeUsers ?? 0,
          appRating: updates.appRating ?? null,
          totalDownloads: updates.totalDownloads ?? 0,
          uptimePercent: updates.uptimePercent ?? null,
          updatedBy: user.userId,
        },
      });
    } else {
      stats = await prisma.appStats.update({
        where: { id: stats.id },
        data: {
          ...(updates.activeUsers !== undefined && { activeUsers: updates.activeUsers }),
          ...(updates.appRating !== undefined && { appRating: updates.appRating }),
          ...(updates.totalDownloads !== undefined && { totalDownloads: updates.totalDownloads }),
          ...(updates.uptimePercent !== undefined && { uptimePercent: updates.uptimePercent }),
          updatedBy: user.userId,
          lastUpdated: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      stats: {
        activeUsers: stats.activeUsers,
        appRating: stats.appRating ? Number(stats.appRating) : null,
        totalDownloads: stats.totalDownloads,
        uptimePercent: stats.uptimePercent ? Number(stats.uptimePercent) : null,
        lastUpdated: stats.lastUpdated,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Failed to update app stats:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update app statistics" },
      { status: error.status || 500 }
    );
  }
}
