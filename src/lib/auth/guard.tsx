/**
 * Auth Guard Utility
 *
 * Provides safe route protection that prevents infinite redirect loops.
 * Use with useAuth hook for client-side guards.
 *
 * DevTools:
 * - Check Console for [Auth Guard] logs (dev only)
 * - Monitor redirect loops in Network tab
 */

"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/check-email",
  "/auth/callback",
  "/bedrock-example",
];

const PROTECTED_ROUTES = [
  "/dashboard",
  "/pos",
  "/inventory",
  "/settings",
  "/users",
  "/reports",
  "/analytics",
];

function safePathname(p: string | null | undefined): string {
  // Next.js can return null in some situations; normalize to "/"
  if (!p) return "/";
  return p;
}

export function useAuthGuard(options?: { redirectTo?: string; requireAuth?: boolean }) {
  const { user, isAuthReady, isLoading } = useAuth();
  const router = useRouter();
  const rawPathname = usePathname();

  const pathname = safePathname(rawPathname);

  const isDev =
    typeof window !== "undefined" && window.location.hostname === "localhost";

  // Decide whether current route requires auth
  const inferredRequireAuth = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const requireAuth = options?.requireAuth ?? inferredRequireAuth;

  const redirectTo = options?.redirectTo || "/login";

  useEffect(() => {
    // Wait for auth to be ready before checking
    if (!isAuthReady || isLoading) {
      if (isDev) {
        console.debug("[Auth Guard] Waiting for auth to be ready", {
          isAuthReady,
          isLoading,
          pathname,
        });
      }
      return;
    }

    // Public routes - always allow
    const isPublic = PUBLIC_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    );

    // NOTE: also allow exact match for root
    if (isPublic || pathname === "/") {
      if (isDev) console.debug("[Auth Guard] Public route, allowing access", { pathname });
      return;
    }

    // Protected routes - require auth
    if (requireAuth && !user) {
      if (isDev) {
        console.debug("[Auth Guard] Protected route without auth, redirecting", {
          pathname,
          redirectTo,
        });
      }

      // Use window.location to avoid router hanging
      const currentUrl =
        (typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : pathname) || "/";

      window.location.href = `${redirectTo}?redirect=${encodeURIComponent(currentUrl)}`;
      return;
    }

    // Authenticated user trying to access login/register - redirect to dashboard
    if (user && (pathname === "/login" || pathname === "/register")) {
      if (isDev) {
        console.debug(
          "[Auth Guard] Authenticated user on auth page, redirecting to dashboard"
        );
      }
      window.location.href = "/dashboard";
      return;
    }

    if (isDev) {
      console.debug("[Auth Guard] Route access allowed", {
        pathname,
        hasUser: !!user,
        requireAuth,
      });
    }
  }, [isAuthReady, isLoading, user, pathname, requireAuth, redirectTo, isDev, router]);
}

/**
 * Simple client-side route guard component
 * Wrap protected routes with this component
 */
export function AuthGuard({
  children,
  requireAuth = true,
  redirectTo = "/login",
}: {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}) {
  useAuthGuard({ requireAuth, redirectTo });
  const { isAuthReady } = useAuth();

  // Show nothing until auth is ready (prevents flash)
  if (!isAuthReady) return null;

  return <>{children}</>;
}
