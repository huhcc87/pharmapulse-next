/**
 * JWT Token Management
 * 
 * Server-authoritative JWT generation and validation.
 * All tokens are signed server-side and validated on every request.
 */

import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
const JWT_ISSUER = process.env.JWT_ISSUER || "pharmapulse";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "pharmapulse-client";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET or NEXTAUTH_SECRET must be set");
}

export interface JWTPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
  sessionId: string; // Active session ID
  deviceId?: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

/**
 * Generate access token (short-lived, 15 minutes)
 */
export function generateAccessToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
  const tokenPayload: JWTPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
  };

  return jwt.sign(tokenPayload, JWT_SECRET!, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithm: "HS256",
  });
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET!, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ["HS256"],
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Generate refresh token (long-lived, 7 days)
 * Returns the token and its hash for storage
 */
export function generateRefreshToken(): { token: string; hash: string } {
  // Generate cryptographically secure random token
  const token = crypto.randomBytes(32).toString("hex");
  
  // Hash for storage (SHA-256)
  const hash = crypto.createHash("sha256").update(token).digest("hex");

  return { token, hash };
}

/**
 * Hash a refresh token for comparison
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000);
}
