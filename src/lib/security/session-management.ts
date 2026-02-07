// Session Management Advanced
// Concurrent session limits, activity monitoring, remote termination

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface SessionActivity {
  sessionId: string;
  userId: string;
  lastActivityAt: Date;
  requestCount: number;
  lastRequestPath?: string;
  ipAddress?: string;
  deviceId?: string;
}

/**
 * Get active sessions for user
 */
export async function getActiveSessions(
  tenantId: string,
  userId: string
): Promise<any[]> {
  try {
    const sessions = await prisma.activeSession.findMany({
      where: {
        tenantId,
        userId,
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        lastActivityAt: "desc",
      },
    });

    return sessions.map((s) => ({
      id: s.id,
      deviceId: s.deviceId,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      lastActivityAt: s.lastActivityAt,
      requestCount: s.requestCount,
      lastRequestPath: s.lastRequestPath,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  } catch (error: any) {
    console.error("Get active sessions error:", error);
    throw error;
  }
}

/**
 * Check concurrent session limit
 */
export async function checkConcurrentSessionLimit(
  tenantId: string,
  userId: string,
  maxSessions: number = 5
): Promise<{
  allowed: boolean;
  currentSessions: number;
  message?: string;
}> {
  try {
    const activeSessions = await prisma.activeSession.count({
      where: {
        tenantId,
        userId,
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (activeSessions >= maxSessions) {
      return {
        allowed: false,
        currentSessions: activeSessions,
        message: `Maximum ${maxSessions} concurrent sessions allowed. Please terminate an existing session.`,
      };
    }

    return {
      allowed: true,
      currentSessions: activeSessions,
    };
  } catch (error: any) {
    console.error("Check concurrent session limit error:", error);
    throw error;
  }
}

/**
 * Terminate session
 */
export async function terminateSession(
  tenantId: string,
  sessionId: string,
  reason?: string
): Promise<void> {
  try {
    await prisma.activeSession.update({
      where: {
        id: sessionId,
        tenantId,
      },
      data: {
        isActive: false,
        terminatedAt: new Date(),
        terminationReason: reason || "Terminated by user",
      },
    });
  } catch (error: any) {
    console.error("Terminate session error:", error);
    throw error;
  }
}

/**
 * Terminate all sessions for user
 */
export async function terminateAllUserSessions(
  tenantId: string,
  userId: string,
  reason?: string
): Promise<number> {
  try {
    const result = await prisma.activeSession.updateMany({
      where: {
        tenantId,
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
        terminatedAt: new Date(),
        terminationReason: reason || "Terminated by admin",
      },
    });

    return result.count;
  } catch (error: any) {
    console.error("Terminate all user sessions error:", error);
    throw error;
  }
}

/**
 * Update session activity
 */
export async function updateSessionActivity(
  sessionId: string,
  requestPath?: string
): Promise<void> {
  try {
    await prisma.activeSession.update({
      where: {
        id: sessionId,
      },
      data: {
        lastActivityAt: new Date(),
        requestCount: {
          increment: 1,
        },
        lastRequestPath: requestPath || undefined,
      },
    });
  } catch (error: any) {
    console.error("Update session activity error:", error);
    // Don't throw - activity tracking failure shouldn't block requests
  }
}

/**
 * Get session activity summary
 */
export async function getSessionActivitySummary(
  tenantId: string,
  userId?: string,
  days: number = 7
): Promise<{
  totalSessions: number;
  activeSessions: number;
  totalRequests: number;
  averageSessionDuration: number; // minutes
  topPaths: Array<{
    path: string;
    count: number;
  }>;
}> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where: any = {
      tenantId,
      createdAt: {
        gte: startDate,
      },
    };
    if (userId) {
      where.userId = userId;
    }

    const sessions = await prisma.activeSession.findMany({
      where,
    });

    const activeSessions = sessions.filter((s) => s.isActive && s.expiresAt > new Date()).length;
    const totalRequests = sessions.reduce((sum, s) => sum + s.requestCount, 0);

    // Calculate average session duration
    const completedSessions = sessions.filter((s) => !s.isActive && s.terminatedAt);
    const avgDuration = completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => {
          const duration = s.terminatedAt!.getTime() - s.createdAt.getTime();
          return sum + duration;
        }, 0) / completedSessions.length / (1000 * 60) // Convert to minutes
      : 0;

    // Top paths
    const pathCounts: Record<string, number> = {};
    for (const session of sessions) {
      if (session.lastRequestPath) {
        pathCounts[session.lastRequestPath] = (pathCounts[session.lastRequestPath] || 0) + 1;
      }
    }

    const topPaths = Object.entries(pathCounts)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalSessions: sessions.length,
      activeSessions,
      totalRequests,
      averageSessionDuration: Math.round(avgDuration),
      topPaths,
    };
  } catch (error: any) {
    console.error("Get session activity summary error:", error);
    throw error;
  }
}
