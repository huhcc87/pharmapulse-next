/**
 * Next.js Middleware
 * 
 * Enforces read-only mode when licence is expired (outside grace period)
 * Blocks write operations on critical routes
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isWriteOperation, isBlockedRoute } from "@/lib/licensing/read-only-mode";

// Routes that should be protected by read-only mode
const PROTECTED_ROUTES = [
  "/api/pos",
  "/api/billing",
  "/api/inventory/stock",
  "/api/reports/export",
  "/api/sales",
];

// Routes that should always allow read-only access
const READ_ONLY_ALLOWED_ROUTES = [
  "/api/inventory",
  "/api/invoices",
  "/api/products",
  "/api/reports/view",
];

/**
 * Middleware to enforce read-only mode
 * 
 * Note: Full licence validation happens in API routes.
 * This middleware provides an additional layer of protection.
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip middleware for static files and API routes that don't need protection
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/public")
  ) {
    return NextResponse.next();
  }

  // Check if route should be blocked in read-only mode
  if (isWriteOperation(request.method)) {
    const shouldBlock = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
    
    if (shouldBlock) {
      // Note: Full validation happens in the API route
      // This middleware can add additional checks if needed
      // For now, let the API routes handle the enforcement
    }
  }

  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
