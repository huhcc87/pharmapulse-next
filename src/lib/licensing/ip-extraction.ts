/**
 * IP Address Extraction Utility
 * 
 * Safely extracts client IP from request, handling:
 * - Direct connections
 * - Reverse proxies (X-Forwarded-For)
 * - Load balancers
 * - Cloud providers (Vercel, AWS, etc.)
 * 
 * Security: Takes first public IP from X-Forwarded-For to prevent spoofing
 */

import { NextRequest } from "next/server";

/**
 * Check if an IP address is private/local
 */
function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("172.16.") || ip.startsWith("172.17.") || 
      ip.startsWith("172.18.") || ip.startsWith("172.19.") ||
      ip.startsWith("172.20.") || ip.startsWith("172.21.") ||
      ip.startsWith("172.22.") || ip.startsWith("172.23.") ||
      ip.startsWith("172.24.") || ip.startsWith("172.25.") ||
      ip.startsWith("172.26.") || ip.startsWith("172.27.") ||
      ip.startsWith("172.28.") || ip.startsWith("172.29.") ||
      ip.startsWith("172.30.") || ip.startsWith("172.31.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("127.")) return true;
  if (ip === "::1" || ip === "localhost") return true;
  
  // IPv6 localhost
  if (ip === "::ffff:127.0.0.1") return true;
  
  return false;
}

/**
 * Extract client IP from request
 * 
 * Priority:
 * 1. X-Forwarded-For header (first public IP)
 * 2. X-Real-IP header
 * 3. CF-Connecting-IP (Cloudflare)
 * 4. req.socket.remoteAddress (direct connection)
 * 
 * @param request - Next.js request object
 * @returns Client IP address or null if not found
 */
export function extractClientIP(request: NextRequest | Request): string | undefined {
  // Try X-Forwarded-For (most common behind proxies)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
    // Take the first one (original client)
    const ips = forwardedFor.split(",").map(ip => ip.trim());
    
    // Find first public IP (security: prevent spoofing)
    for (const ip of ips) {
      if (ip && !isPrivateIP(ip)) {
        return ip;
      }
    }
    
    // If all are private, return the first one anyway (development/local)
    if (ips.length > 0) {
      return ips[0];
    }
  }

  // Try X-Real-IP (nginx reverse proxy)
  const realIP = request.headers.get("x-real-ip");
  if (realIP && !isPrivateIP(realIP)) {
    return realIP;
  }

  // Try Cloudflare header
  const cfIP = request.headers.get("cf-connecting-ip");
  if (cfIP && !isPrivateIP(cfIP)) {
    return cfIP;
  }

  // Try Vercel header
  const vercelIP = request.headers.get("x-vercel-forwarded-for");
  if (vercelIP) {
    const ips = vercelIP.split(",").map(ip => ip.trim());
    for (const ip of ips) {
      if (ip && !isPrivateIP(ip)) {
        return ip;
      }
    }
    if (ips.length > 0) {
      return ips[0];
    }
  }

  // Fallback: direct connection (development)
  // Note: In Next.js, we don't have direct access to socket.remoteAddress
  // This would require accessing the underlying request object
  // For now, return undefined if no IP found in headers
  
  return undefined;
}

/**
 * Normalize IP address for comparison
 * - Removes IPv6 prefix if present
 * - Handles IPv4-mapped IPv6 addresses
 * 
 * @param ip - IP address string
 * @returns Normalized IP address
 */
export function normalizeIP(ip: string): string {
  // Handle IPv4-mapped IPv6: ::ffff:192.168.1.1 -> 192.168.1.1
  if (ip.startsWith("::ffff:")) {
    return ip.substring(7);
  }
  
  return ip.trim();
}

/**
 * Compare two IP addresses
 * Returns true if they match (after normalization)
 * 
 * @param ip1 - First IP address
 * @param ip2 - Second IP address
 * @returns True if IPs match
 */
export function compareIPs(ip1: string | null | undefined, ip2: string | null | undefined): boolean {
  if (!ip1 || !ip2) return false;
  
  const normalized1 = normalizeIP(ip1);
  const normalized2 = normalizeIP(ip2);
  
  return normalized1 === normalized2;
}

/**
 * Alias for extractClientIP for backward compatibility
 */
export const getClientIP = extractClientIP;
