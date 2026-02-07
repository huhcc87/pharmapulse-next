/**
 * Device ID Generation and Management
 * 
 * Strategy:
 * - Web: Generate UUID on first visit, store in httpOnly secure cookie + localStorage fallback
 * - Cookie name: `pp_device_id`
 * - Includes fingerprint metadata for additional security (but doesn't rely on it alone)
 */

import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const DEVICE_ID_COOKIE_NAME = "pp_device_id";
const DEVICE_ID_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

/**
 * Generate a stable device ID
 * Uses UUID v4 for uniqueness and randomness (Node.js built-in crypto.randomUUID)
 */
export function generateDeviceId(): string {
  return randomUUID();
}

/**
 * Get device ID from cookie (server-side)
 * Returns null if not found
 */
export async function getDeviceIdFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const deviceIdCookie = cookieStore.get(DEVICE_ID_COOKIE_NAME);
  return deviceIdCookie?.value || null;
}

/**
 * Set device ID in httpOnly secure cookie (server-side)
 * This is the primary storage mechanism for security
 */
export async function setDeviceIdCookie(deviceId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(DEVICE_ID_COOKIE_NAME, deviceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: DEVICE_ID_COOKIE_MAX_AGE,
    path: "/",
  });
}

/**
 * Get or create device ID
 * - First checks cookie (preferred)
 * - If not found, generates new ID and sets cookie
 * - Returns the device ID
 */
export async function getOrCreateDeviceId(): Promise<string> {
  let deviceId = await getDeviceIdFromCookie();
  
  if (!deviceId) {
    deviceId = generateDeviceId();
    await setDeviceIdCookie(deviceId);
  }
  
  return deviceId;
}

/**
 * Generate device fingerprint metadata (for logging/audit)
 * This is NOT used for enforcement, only for audit purposes
 * 
 * @param userAgent - Browser user agent string
 * @param headers - Request headers (for additional metadata)
 */
export function generateDeviceFingerprint(
  userAgent: string | null,
  headers: Headers
): Record<string, string> {
  const fingerprint: Record<string, string> = {
    userAgent: userAgent || "unknown",
    platform: headers.get("sec-ch-ua-platform") || "unknown",
    language: headers.get("accept-language")?.split(",")[0] || "unknown",
  };

  // Add timezone if available (client-side only, but we can log it)
  // Note: Timezone detection requires client-side JavaScript
  // This is just metadata for audit, not enforcement

  return fingerprint;
}

/**
 * Client-side: Get device ID from localStorage (fallback)
 * This is used as a fallback if cookie is not available
 * 
 * Note: This should be called from client components only
 */
export function getDeviceIdFromLocalStorage(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DEVICE_ID_COOKIE_NAME);
}

/**
 * Client-side: Set device ID in localStorage (fallback)
 * This is used as a fallback if cookie is not available
 * 
 * Note: This should be called from client components only
 */
export function setDeviceIdLocalStorage(deviceId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEVICE_ID_COOKIE_NAME, deviceId);
}
