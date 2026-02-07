// Security Event Streaming
// Real-time security event streaming via API (WebSocket would be separate implementation)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface SecurityEventFilter {
  eventType?: string;
  severity?: "info" | "warning" | "error" | "critical";
  userId?: string;
  ipAddress?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

/**
 * Get security events with filtering
 */
export async function getSecurityEvents(
  tenantId: string,
  filter: SecurityEventFilter = {}
): Promise<any[]> {
  try {
    const where: any = {
      tenantId,
    };

    if (filter.eventType) {
      where.eventType = filter.eventType;
    }

    if (filter.severity) {
      where.severity = filter.severity;
    }

    if (filter.userId) {
      where.userId = filter.userId;
    }

    if (filter.ipAddress) {
      where.ipAddress = filter.ipAddress;
    }

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) {
        where.createdAt.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.createdAt.lte = filter.endDate;
      }
    }

    const events = await prisma.securityEvent.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: filter.limit || 100,
    });

    return events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      severity: e.severity,
      userId: e.userId,
      ipAddress: e.ipAddress,
      userAgent: e.userAgent,
      deviceId: e.deviceId,
      metadata: e.metadata,
      correlationId: e.correlationId,
      createdAt: e.createdAt,
    }));
  } catch (error: any) {
    console.error("Get security events error:", error);
    throw error;
  }
}

/**
 * Create custom alert rule
 */
export async function createAlertRule(
  tenantId: string,
  data: {
    name: string;
    description?: string;
    conditions: {
      eventType?: string;
      severity?: string;
      threshold?: number; // Number of events in time window
      timeWindow?: number; // Minutes
    };
    actions: Array<{
      type: "EMAIL" | "WEBHOOK" | "SLACK" | "PAGERDUTY";
      target: string;
    }>;
  }
): Promise<any> {
  try {
    // Store alert rule (would need AlertRule model in schema)
    // For now, return placeholder
    return {
      id: `ALERT-${Date.now()}`,
      name: data.name,
      description: data.description,
      conditions: data.conditions,
      actions: data.actions,
      createdAt: new Date(),
    };
  } catch (error: any) {
    console.error("Create alert rule error:", error);
    throw error;
  }
}

/**
 * Correlate security events
 */
export async function correlateSecurityEvents(
  tenantId: string,
  correlationId: string
): Promise<{
  correlationId: string;
  events: any[];
  pattern?: string;
  riskScore: number;
}> {
  try {
    const events = await prisma.securityEvent.findMany({
      where: {
        tenantId,
        correlationId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Calculate risk score based on event types and severity
    let riskScore = 0;
    for (const event of events) {
      if (event.severity === "critical") {
        riskScore += 10;
      } else if (event.severity === "error") {
        riskScore += 5;
      } else if (event.severity === "warning") {
        riskScore += 2;
      } else {
        riskScore += 1;
      }
    }

    // Detect patterns
    const eventTypes = events.map((e) => e.eventType);
    const pattern = detectPattern(eventTypes);

    return {
      correlationId,
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        severity: e.severity,
        createdAt: e.createdAt,
      })),
      pattern,
      riskScore: Math.min(100, riskScore),
    };
  } catch (error: any) {
    console.error("Correlate security events error:", error);
    throw error;
  }
}

function detectPattern(eventTypes: string[]): string | undefined {
  // Simple pattern detection
  if (eventTypes.length >= 3) {
    const uniqueTypes = new Set(eventTypes);
    if (uniqueTypes.size === 1) {
      return `REPEATED_${eventTypes[0]}`;
    }
    if (eventTypes.includes("LOGIN_FAILED") && eventTypes.includes("LOGIN_SUCCESS")) {
      return "BRUTE_FORCE_ATTEMPT";
    }
  }
  return undefined;
}
