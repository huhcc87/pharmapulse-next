/**
 * Client-side Auth Setup Helper
 * 
 * This can be called from the client to ensure cookies are set
 * Useful for development or when cookies are missing
 */

"use client";

/**
 * Setup authentication cookies (client-side)
 * This is a helper for development/testing
 * 
 * Note: In production, cookies should be set by the login system
 */
export async function setupAuthCookies(
  tenantId: string,
  userId: string,
  email: string = "admin@pharmapulse.com",
  role: string = "owner"
): Promise<boolean> {
  try {
    // Call API endpoint to set cookies
    const res = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, userId, email, role }),
    });

    return res.ok;
  } catch (error) {
    console.error("Failed to setup auth cookies:", error);
    return false;
  }
}

/**
 * Check if user is authenticated (client-side check)
 */
export function isAuthenticated(): boolean {
  if (typeof document === "undefined") return false;
  
  // Check if cookies exist (can't read httpOnly cookies from client, but we can check if API works)
  return true; // Always return true, let server validate
}
