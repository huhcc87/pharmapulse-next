// IP Whitelisting & Geo-Blocking
// CIDR support, geo-location blocking, IP reputation

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface IpWhitelistData {
  ipAddress: string; // Can be CIDR notation
  description?: string;
}

export interface GeoBlockingRuleData {
  countryCode: string;
  countryName: string;
  action: "BLOCK" | "ALLOW" | "CHALLENGE";
  reason?: string;
}

/**
 * Check if IP is whitelisted
 */
export async function isIpWhitelisted(
  tenantId: string,
  ipAddress: string
): Promise<boolean> {
  try {
    const whitelists = await prisma.ipWhitelist.findMany({
      where: {
        tenantId,
        isActive: true,
      },
    });

    for (const whitelist of whitelists) {
      if (isIpInRange(ipAddress, whitelist.ipAddress)) {
        return true;
      }
    }

    return false;
  } catch (error: any) {
    console.error("Check IP whitelist error:", error);
    return false; // Default to not whitelisted on error
  }
}

/**
 * Check if IP is blacklisted
 */
export async function isIpBlacklisted(
  tenantId: string | null,
  ipAddress: string
): Promise<boolean> {
  try {
    // Check tenant-specific blacklist
    if (tenantId) {
      const tenantBlacklist = await prisma.ipBlacklist.findMany({
        where: {
          tenantId,
          isActive: true,
        },
      });

      for (const blacklist of tenantBlacklist) {
        if (isIpInRange(ipAddress, blacklist.ipAddress)) {
          return true;
        }
      }
    }

    // Check global blacklist
    const globalBlacklist = await prisma.ipBlacklist.findMany({
      where: {
        tenantId: null,
        isActive: true,
      },
    });

    for (const blacklist of globalBlacklist) {
      if (isIpInRange(ipAddress, blacklist.ipAddress)) {
        return true;
      }
    }

    return false;
  } catch (error: any) {
    console.error("Check IP blacklist error:", error);
    return false; // Default to not blacklisted on error
  }
}

/**
 * Check geo-blocking
 */
export async function checkGeoBlocking(
  tenantId: string,
  countryCode: string
): Promise<{
  blocked: boolean;
  action?: "BLOCK" | "ALLOW" | "CHALLENGE";
  reason?: string;
}> {
  try {
    const rule = await prisma.geoBlockingRule.findFirst({
      where: {
        tenantId,
        countryCode,
        isActive: true,
      },
    });

    if (!rule) {
      return {
        blocked: false,
        action: "ALLOW",
      };
    }

    if (rule.action === "BLOCK") {
      return {
        blocked: true,
        action: "BLOCK",
        reason: rule.reason || `Country ${rule.countryName} is blocked`,
      };
    } else if (rule.action === "CHALLENGE") {
      return {
        blocked: false,
        action: "CHALLENGE",
        reason: rule.reason || `Additional verification required for ${rule.countryName}`,
      };
    }

    return {
      blocked: false,
      action: "ALLOW",
    };
  } catch (error: any) {
    console.error("Check geo-blocking error:", error);
    return {
      blocked: false,
      action: "ALLOW",
    };
  }
}

/**
 * Add IP to whitelist
 */
export async function addIpToWhitelist(
  tenantId: string,
  data: IpWhitelistData
): Promise<any> {
  try {
    const whitelist = await prisma.ipWhitelist.create({
      data: {
        tenantId,
        ipAddress: data.ipAddress,
        description: data.description || null,
        isActive: true,
      },
    });

    return whitelist;
  } catch (error: any) {
    console.error("Add IP to whitelist error:", error);
    throw error;
  }
}

/**
 * Add IP to blacklist
 */
export async function addIpToBlacklist(
  tenantId: string | null,
  ipAddress: string,
  reason?: string
): Promise<any> {
  try {
    const blacklist = await prisma.ipBlacklist.create({
      data: {
        tenantId,
        ipAddress,
        reason: reason || null,
        isActive: true,
      },
    });

    return blacklist;
  } catch (error: any) {
    console.error("Add IP to blacklist error:", error);
    throw error;
  }
}

/**
 * Create geo-blocking rule
 */
export async function createGeoBlockingRule(
  tenantId: string,
  data: GeoBlockingRuleData
): Promise<any> {
  try {
    const rule = await prisma.geoBlockingRule.create({
      data: {
        tenantId,
        countryCode: data.countryCode,
        countryName: data.countryName,
        action: data.action,
        reason: data.reason || null,
        isActive: true,
      },
    });

    return rule;
  } catch (error: any) {
    console.error("Create geo-blocking rule error:", error);
    throw error;
  }
}

// Helper function to check if IP is in range (supports CIDR)
function isIpInRange(ip: string, range: string): boolean {
  if (range.includes("/")) {
    // CIDR notation
    return isIpInCidr(ip, range);
  } else {
    // Exact match
    return ip === range;
  }
}

function isIpInCidr(ip: string, cidr: string): boolean {
  // Simplified CIDR check (would need proper IP address library in production)
  const [network, prefix] = cidr.split("/");
  const prefixLength = parseInt(prefix);
  
  // Convert IPs to numbers for comparison
  const ipParts = ip.split(".").map(Number);
  const networkParts = network.split(".").map(Number);
  
  // Check if IP matches network prefix
  const mask = (0xFFFFFFFF << (32 - prefixLength)) >>> 0;
  const ipNum = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
  const networkNum = (networkParts[0] << 24) + (networkParts[1] << 16) + (networkParts[2] << 8) + networkParts[3];
  
  return (ipNum & mask) === (networkNum & mask);
}
