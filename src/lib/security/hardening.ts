/**
 * API Hardening: CORS, CSP, Rate Limiting, Build Tokens
 * 
 * Implements security headers and rate limiting for API protection
 */

import { NextRequest, NextResponse } from "next/server";

// CORS allowed origins (from environment)
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || [
    "http://localhost:3000",
    "http://localhost:3001",
  ]
).filter(Boolean);

// Build token validation (from environment)
const BUILD_TOKEN = process.env.BUILD_TOKEN || process.env.NEXT_PUBLIC_BUILD_TOKEN;

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Add CORS headers to response
 */
export function addCorsHeaders(
  response: NextResponse,
  origin: string | null
): NextResponse {
  if (isOriginAllowed(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Build-Token");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Max-Age", "86400"); // 24 hours
  }
  return response;
}

/**
 * Add Content Security Policy headers
 */
export function addCSPHeaders(response: NextResponse): NextResponse {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline/eval
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

/**
 * Validate build token
 * Frontend must include X-Build-Token header
 */
export function validateBuildToken(request: NextRequest): boolean {
  // Skip in development
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  if (!BUILD_TOKEN) {
    // No token configured = skip validation
    return true;
  }

  const token = request.headers.get("x-build-token");
  return token === BUILD_TOKEN;
}

/**
 * Simple in-memory rate limiter (for demo)
 * In production, use Redis or similar
 */
const rateLimitStore = new Map<
  string,
  { count: number; resetAt: number }
>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
}

const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  "/api/auth": { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 min
  "/api/licensing": { maxRequests: 10, windowMs: 60 * 1000 }, // 10 per min
  "/api/security": { maxRequests: 20, windowMs: 60 * 1000 }, // 20 per min
  default: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 per min
};

/**
 * Check rate limit for a request
 * Returns { allowed: boolean, remaining: number, resetAt: Date }
 */
export function checkRateLimit(
  key: string, // Usually IP + route
  config?: RateLimitConfig
): {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
} {
  const limitConfig = config || DEFAULT_RATE_LIMITS.default;
  const now = Date.now();

  const record = rateLimitStore.get(key);

  if (!record || record.resetAt < now) {
    // New window or expired
    const resetAt = now + limitConfig.windowMs;
    rateLimitStore.set(key, {
      count: 1,
      resetAt,
    });
    return {
      allowed: true,
      remaining: limitConfig.maxRequests - 1,
      resetAt: new Date(resetAt),
    };
  }

  // Existing window
  if (record.count >= limitConfig.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(record.resetAt),
    };
  }

  record.count++;
  return {
    allowed: true,
    remaining: limitConfig.maxRequests - record.count,
    resetAt: new Date(record.resetAt),
  };
}

/**
 * Get rate limit config for a route
 */
export function getRateLimitConfig(route: string): RateLimitConfig {
  for (const [prefix, config] of Object.entries(DEFAULT_RATE_LIMITS)) {
    if (route.startsWith(prefix)) {
      return config;
    }
  }
  return DEFAULT_RATE_LIMITS.default;
}

/**
 * Cleanup expired rate limit records (call periodically)
 */
export function cleanupRateLimitStore(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetAt < now) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Middleware: Apply security headers and rate limiting
 */
export function applySecurityMiddleware(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const origin = request.headers.get("origin");
  const route = request.nextUrl.pathname;

  // Add CORS headers
  addCorsHeaders(response, origin);

  // Add CSP headers (for web routes)
  if (route.startsWith("/api")) {
    // API routes don't need CSP, but add other security headers
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
  } else {
    // Web routes get full CSP
    addCSPHeaders(response);
  }

  // Validate build token (if configured)
  if (!validateBuildToken(request)) {
    return NextResponse.json(
      { error: "Invalid build token" },
      { status: 403 }
    );
  }

  // Rate limiting
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ||
             request.headers.get("x-real-ip") ||
             "unknown";
  const rateLimitKey = `${ip}:${route}`;
  const rateLimitConfig = getRateLimitConfig(route);
  const rateLimit = checkRateLimit(rateLimitKey, rateLimitConfig);

  if (!rateLimit.allowed) {
    response.headers.set("X-RateLimit-Limit", rateLimitConfig.maxRequests.toString());
    response.headers.set("X-RateLimit-Remaining", "0");
    response.headers.set("X-RateLimit-Reset", rateLimit.resetAt.getTime().toString());
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retryAfter: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": rateLimitConfig.maxRequests.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimit.resetAt.getTime().toString(),
        },
      }
    );
  }

  // Add rate limit headers
  response.headers.set("X-RateLimit-Limit", rateLimitConfig.maxRequests.toString());
  response.headers.set("X-RateLimit-Remaining", rateLimit.remaining.toString());
  response.headers.set("X-RateLimit-Reset", rateLimit.resetAt.getTime().toString());

  return response;
}
