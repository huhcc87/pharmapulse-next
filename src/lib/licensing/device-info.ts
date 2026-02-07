/**
 * Device Information Utilities
 * 
 * Parses User-Agent to extract OS, Browser, and other device information
 */

/**
 * Parse User-Agent to extract OS
 */
export function parseOperatingSystem(userAgent: string | null): string {
  if (!userAgent) return "Unknown";

  const ua = userAgent.toLowerCase();

  if (ua.includes("win")) return "Windows";
  if (ua.includes("mac")) return "macOS";
  if (ua.includes("linux")) return "Linux";
  if (ua.includes("android")) return "Android";
  if (ua.includes("ios") || ua.includes("iphone") || ua.includes("ipad")) return "iOS";

  return "Unknown";
}

/**
 * Parse User-Agent to extract Browser
 */
export function parseBrowser(userAgent: string | null): string {
  if (!userAgent) return "Unknown";

  const ua = userAgent.toLowerCase();

  if (ua.includes("edg/")) return "Microsoft Edge";
  if (ua.includes("chrome/") && !ua.includes("edg/")) return "Google Chrome";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";
  if (ua.includes("firefox/")) return "Firefox";
  if (ua.includes("opera/") || ua.includes("opr/")) return "Opera";
  if (ua.includes("msie") || ua.includes("trident/")) return "Internet Explorer";

  return "Unknown";
}

/**
 * Extract device information from User-Agent
 */
export function extractDeviceInfo(userAgent: string | null): {
  operatingSystem: string;
  browser: string;
  userAgent: string;
} {
  return {
    operatingSystem: parseOperatingSystem(userAgent),
    browser: parseBrowser(userAgent),
    userAgent: userAgent || "Unknown",
  };
}
