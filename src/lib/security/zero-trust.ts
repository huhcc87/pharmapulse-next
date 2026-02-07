// Zero Trust Architecture Controls
// Policy-based access control, continuous verification

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface ZeroTrustPolicyData {
  name: string;
  description?: string;
  resourcePattern: string;
  allowedRoles?: string[];
  requiredMfa?: boolean;
  ipWhitelist?: string[];
  deviceTrustLevel?: "TRUSTED" | "SUSPICIOUS" | "UNTRUSTED";
  timeRestrictions?: {
    start: string;
    end: string;
    timezone: string;
  };
  action: "ALLOW" | "DENY" | "CHALLENGE";
  priority?: number;
}

export interface AccessDecision {
  decision: "ALLOWED" | "DENIED" | "CHALLENGED";
  reason: string;
  policyId?: string;
  policyName?: string;
}

/**
 * Evaluate zero trust policy for a request
 */
export async function evaluateZeroTrustAccess(
  tenantId: string,
  context: {
    userId?: string;
    userRole?: string;
    resource: string;
    method: string;
    ipAddress?: string;
    deviceId?: string;
    deviceTrustScore?: number;
    mfaVerified?: boolean;
    geoLocation?: {
      country: string;
      city?: string;
    };
  }
): Promise<AccessDecision> {
  try {
    // Get active policies for this tenant, ordered by priority
    const policies = await prisma.zeroTrustPolicy.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: {
        priority: "desc",
      },
    });

    // Evaluate each policy
    for (const policy of policies) {
      // Check if resource matches pattern
      if (!matchesPattern(context.resource, policy.resourcePattern)) {
        continue;
      }

      // Check role
      if (policy.allowedRoles) {
        const allowedRoles = policy.allowedRoles as string[];
        if (context.userRole && !allowedRoles.includes(context.userRole)) {
          continue; // Try next policy
        }
      }

      // Check MFA requirement
      if (policy.requiredMfa && !context.mfaVerified) {
        return {
          decision: "CHALLENGED",
          reason: "MFA verification required",
          policyId: policy.id,
          policyName: policy.name,
        };
      }

      // Check IP whitelist
      if (policy.ipWhitelist && context.ipAddress) {
        const whitelist = policy.ipWhitelist as string[];
        if (!isIpInList(context.ipAddress, whitelist)) {
          continue; // Try next policy
        }
      }

      // Check device trust level
      if (policy.deviceTrustLevel && context.deviceTrustScore !== undefined) {
        const trustLevel = getDeviceTrustLevel(context.deviceTrustScore);
        if (trustLevel !== policy.deviceTrustLevel) {
          continue; // Try next policy
        }
      }

      // Check time restrictions
      if (policy.timeRestrictions) {
        const restrictions = policy.timeRestrictions as any;
        if (!isWithinTimeWindow(restrictions)) {
          continue; // Try next policy
        }
      }

      // Policy matched - apply action
      if (policy.action === "DENY") {
        return {
          decision: "DENIED",
          reason: `Blocked by policy: ${policy.name}`,
          policyId: policy.id,
          policyName: policy.name,
        };
      } else if (policy.action === "CHALLENGE") {
        return {
          decision: "CHALLENGED",
          reason: `Challenge required by policy: ${policy.name}`,
          policyId: policy.id,
          policyName: policy.name,
        };
      } else {
        // ALLOW
        return {
          decision: "ALLOWED",
          reason: `Allowed by policy: ${policy.name}`,
          policyId: policy.id,
          policyName: policy.name,
        };
      }
    }

    // No policy matched - default deny
    return {
      decision: "DENIED",
      reason: "No matching policy found - default deny",
    };
  } catch (error: any) {
    console.error("Evaluate zero trust access error:", error);
    throw error;
  }
}

/**
 * Create zero trust policy
 */
export async function createZeroTrustPolicy(
  tenantId: string,
  data: ZeroTrustPolicyData
): Promise<any> {
  try {
    const policy = await prisma.zeroTrustPolicy.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description || null,
        resourcePattern: data.resourcePattern,
        allowedRoles: data.allowedRoles ? JSON.parse(JSON.stringify(data.allowedRoles)) : null,
        requiredMfa: data.requiredMfa || false,
        ipWhitelist: data.ipWhitelist ? JSON.parse(JSON.stringify(data.ipWhitelist)) : null,
        deviceTrustLevel: data.deviceTrustLevel || null,
        timeRestrictions: data.timeRestrictions ? JSON.parse(JSON.stringify(data.timeRestrictions)) : null,
        action: data.action,
        priority: data.priority || 0,
        isActive: true,
      },
    });

    return policy;
  } catch (error: any) {
    console.error("Create zero trust policy error:", error);
    throw error;
  }
}

/**
 * Log access decision
 */
export async function logZeroTrustAccess(
  tenantId: string,
  context: {
    userId?: string;
    resource: string;
    method: string;
    ipAddress?: string;
    userAgent?: string;
    deviceId?: string;
    decision: string;
    reason: string;
    policyId?: string;
    policyName?: string;
    mfaVerified?: boolean;
    deviceTrustScore?: number;
    geoLocation?: any;
  }
): Promise<void> {
  try {
    await prisma.zeroTrustAccessLog.create({
      data: {
        tenantId,
        userId: context.userId || null,
        resource: context.resource,
        method: context.method,
        ipAddress: context.ipAddress || null,
        userAgent: context.userAgent || null,
        deviceId: context.deviceId || null,
        policyId: context.policyId || null,
        policyName: context.policyName || null,
        decision: context.decision,
        reason: context.reason || null,
        mfaVerified: context.mfaVerified || false,
        deviceTrustScore: context.deviceTrustScore || null,
        geoLocation: context.geoLocation ? JSON.parse(JSON.stringify(context.geoLocation)) : null,
      },
    });
  } catch (error: any) {
    console.error("Log zero trust access error:", error);
    // Don't throw - logging failure shouldn't block requests
  }
}

// Helper functions
function matchesPattern(resource: string, pattern: string): boolean {
  // Simple pattern matching (supports * wildcard)
  const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
  return regex.test(resource);
}

function isIpInList(ip: string, list: string[]): boolean {
  for (const entry of list) {
    if (entry.includes("/")) {
      // CIDR notation
      if (isIpInCidr(ip, entry)) {
        return true;
      }
    } else {
      // Exact match
      if (ip === entry) {
        return true;
      }
    }
  }
  return false;
}

function isIpInCidr(ip: string, cidr: string): boolean {
  // Simplified CIDR check (would need proper IP address library in production)
  const [network, prefix] = cidr.split("/");
  return ip.startsWith(network); // Simplified check
}

function getDeviceTrustLevel(score: number): "TRUSTED" | "SUSPICIOUS" | "UNTRUSTED" {
  if (score >= 70) return "TRUSTED";
  if (score >= 50) return "SUSPICIOUS";
  return "UNTRUSTED";
}

function isWithinTimeWindow(restrictions: {
  start: string;
  end: string;
  timezone: string;
}): boolean {
  // Simplified time check (would need proper timezone handling in production)
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours * 60 + minutes;

  const [startHour, startMin] = restrictions.start.split(":").map(Number);
  const [endHour, endMin] = restrictions.end.split(":").map(Number);
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  return currentTime >= startTime && currentTime <= endTime;
}
