/**
 * Auth Callback Route - For Supabase Email Verification & OAuth
 * 
 * This route handles:
 * - Email verification callbacks (after user clicks confirmation link)
 * - Password reset callbacks (after user clicks reset link)
 * - OAuth callbacks (if OAuth providers are configured)
 * 
 * Supabase Configuration:
 * 1. Go to Supabase Dashboard → Authentication → URL Configuration
 * 2. Add redirect URLs:
 *    - http://localhost:3000/auth/callback (for dev)
 *    - https://yourdomain.com/auth/callback (for production)
 * 3. Enable email confirmations in Authentication → Settings
 * 
 * Supabase automatically handles token verification and session creation.
 * We just need to exchange the code/token for a session and redirect.
 * 
 * DevTools:
 * - Check Network tab for callback request
 * - Check Server logs for [Auth Callback] debug logs (dev only)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/client";

const isDev = process.env.NODE_ENV === 'development';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code'); // OAuth code
  const token = searchParams.get('token'); // Email verification token
  const type = searchParams.get('type') || searchParams.get('token_hash') ? 'email' : 'oauth';
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (isDev) {
    console.debug('[Auth Callback] Callback received', {
      type,
      hasCode: !!code,
      hasToken: !!token,
      hasError: !!error,
      timestamp: new Date().toISOString(),
    });
  }

  // Handle OAuth/email verification errors
  if (error) {
    if (isDev) {
      console.debug('[Auth Callback] Error in callback', {
        error,
        errorDescription,
      });
    }
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDescription || error)}`, request.url)
    );
  }

  try {
    const supabase = createServerClient();

    // Handle email verification token (token_hash in URL)
    if (token || searchParams.get('token_hash')) {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: token || searchParams.get('token_hash') || '',
        type: 'email',
      });

      if (verifyError) {
        if (isDev) {
          console.debug('[Auth Callback] Email verification failed', {
            error: verifyError.message,
          });
        }
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent(verifyError.message)}`, request.url)
        );
      }

      if (data?.session) {
        // Session created - redirect to dashboard
        if (isDev) {
          console.debug('[Auth Callback] Email verified, session created', {
            userId: data.user?.id,
          });
        }
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    // Handle OAuth code exchange
    if (code) {
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        if (isDev) {
          console.debug('[Auth Callback] Code exchange failed', {
            error: exchangeError.message,
          });
        }
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, request.url)
        );
      }

      if (data?.session) {
        // Session created - redirect to dashboard
        if (isDev) {
          console.debug('[Auth Callback] OAuth session created', {
            userId: data.user?.id,
          });
        }
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    // No code or token - redirect to login
    return NextResponse.redirect(
      new URL('/login?error=invalid_callback', request.url)
    );

  } catch (error: any) {
    if (isDev) {
      console.debug('[Auth Callback] Callback exception', {
        error: error.message,
        stack: error.stack,
      });
    }

    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message || 'verification_failed')}`, request.url)
    );
  }
}

export async function POST(request: NextRequest) {
  // Handle POST callbacks (e.g., from webhooks)
  return NextResponse.json(
    { error: 'POST callback not implemented. Use GET for OAuth/email verification.' },
    { status: 501 }
  );
}