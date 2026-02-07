/**
 * Auth State Hook with isAuthReady
 * 
 * Provides safe auth state management that prevents infinite loading loops.
 * Use this instead of directly checking cookies/session to avoid auth listener issues.
 * 
 * DevTools: Check Network tab for /api/auth/status calls and Console for auth state logs.
 */

"use client";

import { useState, useEffect, useCallback } from "react";

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthReady: boolean; // true when auth check is complete (even if no user)
  isLoading: boolean;
  error: string | null;
}

const TIMEOUT_MS = 5000; // 5 second timeout for auth check

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthReady: false,
    isLoading: true,
    error: null,
  });

  const checkAuth = useCallback(async () => {
    // Only run on client
    if (typeof window === "undefined" || typeof document === "undefined") {
      setState({
        user: null,
        isAuthReady: true,
        isLoading: false,
        error: null,
      });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        // Check auth status (or use cookies directly if no API)
        // For cookie-based auth, we can check cookies directly
        const hasCookies = 
          document.cookie.includes('pp_user=') && 
          document.cookie.includes('pp_tenant=');

        clearTimeout(timeoutId);

        if (hasCookies) {
          // Parse cookies to get user info (non-sensitive data only)
          const cookies = document.cookie.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
            return acc;
          }, {} as Record<string, string>);

          setState({
            user: {
              userId: cookies['pp_user'] || '',
              email: cookies['pp_email'] || '',
              role: cookies['pp_role'] || 'owner',
              tenantId: cookies['pp_tenant'] || '',
            },
            isAuthReady: true,
            isLoading: false,
            error: null,
          });
        } else {
          // No auth - this is normal for public pages
          setState({
            user: null,
            isAuthReady: true,
            isLoading: false,
            error: null,
          });
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          // Timeout - assume no auth and continue
          if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            console.debug('[useAuth] Auth check timed out, continuing without auth');
          }
          setState({
            user: null,
            isAuthReady: true,
            isLoading: false,
            error: null,
          });
        } else {
          throw fetchError;
        }
      }
    } catch (error: any) {
      // Auth check failed - set ready anyway to prevent infinite loading
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        console.debug('[useAuth] Auth check failed (non-fatal):', error);
      }
      setState({
        user: null,
        isAuthReady: true,
        isLoading: false,
        error: error.message || 'Auth check failed',
      });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const signOut = useCallback(() => {
    // Only run on client side
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    // Clear auth cookies
    document.cookie = 'pp_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'pp_tenant=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'pp_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'pp_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    
    setState({
      user: null,
      isAuthReady: true,
      isLoading: false,
      error: null,
    });
    
    window.location.href = '/login';
  }, []);

  return {
    ...state,
    signOut,
    refresh: checkAuth,
  };
}