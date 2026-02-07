/**
 * Sign In Page - Supabase Auth with Real Error Messages
 * 
 * DevTools:
 * - Network tab: Check /api/auth/login request
 * - Console tab: Look for [SignIn:reqId] debug logs (dev only)
 * - Debug panel shows requestId, step, status, error, Supabase URL (masked)
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, Copy, Eye, EyeOff } from "lucide-react";
import { supabase, getSupabaseConfigStatus, getSupabaseHostname, maskSupabaseKey } from "@/lib/supabase/client";

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

interface AuthError {
  message: string;
  code?: string;
  hint?: string;
  actionHint?: string;
  actionType?: 'resend' | 'reset' | 'none';
}

function mapSupabaseError(error: any): AuthError {
  const errorMessage = error?.message || error?.error_description || String(error || 'Unknown error');
  const status = error?.status;

  // Email not confirmed
  if (
    errorMessage.toLowerCase().includes('email not confirmed') ||
    errorMessage.toLowerCase().includes('email_not_confirmed') ||
    status === 400 || status === 401
  ) {
    if (errorMessage.toLowerCase().includes('email') && errorMessage.toLowerCase().includes('confirm')) {
      return {
        message: "Your account exists but email is not verified.",
        code: "EMAIL_NOT_CONFIRMED",
        hint: "Please check your inbox/spam folder and click the confirmation link.",
        actionHint: "Resend verification email",
        actionType: 'resend',
      };
    }
  }

  // Invalid credentials
  if (
    errorMessage.toLowerCase().includes('invalid login credentials') ||
    errorMessage.toLowerCase().includes('invalid_credentials') ||
    errorMessage.toLowerCase().includes('incorrect email') ||
    errorMessage.toLowerCase().includes('incorrect password')
  ) {
    return {
      message: "Incorrect email or password.",
      code: "INVALID_CREDENTIALS",
      hint: "If you just signed up, confirm your email first or reset your password.",
      actionHint: "Reset password",
      actionType: 'reset',
    };
  }

  // User not found
  if (errorMessage.toLowerCase().includes('user not found') || errorMessage.toLowerCase().includes('no user')) {
    return {
      message: "No account found with this email.",
      code: "USER_NOT_FOUND",
      hint: "Please check your email or create a new account.",
      actionType: 'none',
    };
  }

  // Generic error - show real message
  return {
    message: errorMessage,
    code: error?.code || "AUTH_ERROR",
    hint: "Please try again or contact support if the issue persists.",
    actionType: 'none',
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [configStatus, setConfigStatus] = useState<{ ok: boolean; missing: string[]; urlHost?: string } | null>(null);
  const requestIdRef = useRef<string>("");
  const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';

  // Check Supabase configuration on mount
  useEffect(() => {
    const status = getSupabaseConfigStatus();
    setConfigStatus(status);
    
    if (!status.ok) {
      setError({
        message: "Authentication service is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart the dev server.",
        code: "SUPABASE_NOT_CONFIGURED",
        actionType: 'none',
      });
    }
  }, []);

  const copyDebugInfo = () => {
    if (debugInfo) {
      navigator.clipboard.writeText(debugInfo);
      alert('Debug info copied to clipboard!');
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      setError({
        message: "Please enter your email address first.",
        code: "NO_EMAIL",
        actionType: 'none',
      });
      return;
    }

    setIsResending(true);
    const reqId = generateRequestId();
    requestIdRef.current = reqId;

    if (!supabase) {
      setError({
        message: "Authentication service is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart the dev server.",
        code: "SUPABASE_NOT_CONFIGURED",
        actionType: 'none',
      });
      setIsResending(false);
      return;
    }

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      });

      if (resendError) {
        setError({
          message: resendError.message || "Failed to resend verification email.",
          code: "RESEND_ERROR",
          actionType: 'none',
        });
      } else {
        setError({
          message: "Verification email sent! Please check your inbox.",
          code: "RESEND_SUCCESS",
          actionType: 'none',
        });
        // Clear error after 5 seconds
        setTimeout(() => setError(null), 5000);
      }
    } catch (err: any) {
      setError({
        message: err.message || "Failed to resend verification email. Please try again.",
        code: "RESEND_ERROR",
        actionType: 'none',
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDebugInfo("");
    setIsLoading(true);

    const reqId = generateRequestId();
    requestIdRef.current = reqId;
    const startTime = Date.now();

    if (isDev) {
      console.debug(`[SignIn:${reqId}] Starting sign in`, {
        email: email.trim().toLowerCase(),
        timestamp: new Date().toISOString(),
        supabaseHostname: getSupabaseHostname(),
      });
    }

    if (!supabase) {
      setError({
        message: "Authentication service is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart the dev server.",
        code: "SUPABASE_NOT_CONFIGURED",
        actionType: 'none',
      });
      setIsLoading(false);
      return;
    }

    try {
      const normalizedEmail = email.trim().toLowerCase();

      // Call Supabase sign in
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      const duration = Date.now() - startTime;

      if (signInError) {
        const mappedError = mapSupabaseError(signInError);
        
        const debugText = `Request ID: ${reqId}\nStep: signin\nStatus: ${signInError.status || 'error'}\nError Code: ${mappedError.code}\nError Message: ${signInError.message}\nDuration: ${duration}ms\nSupabase URL: ${getSupabaseHostname()}\nSupabase Key (masked): ${maskSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'not-set')}`;
        setDebugInfo(debugText);

        if (isDev) {
          console.debug(`[SignIn:${reqId}] Sign in FAILED`, {
            error: signInError.message,
            code: signInError.status,
            mappedError: mappedError.code,
            duration,
          });
        }

        setError(mappedError);
        setIsLoading(false);
        return;
      }

      // Success - session exists
      if (data?.session) {
        if (isDev) {
          console.debug(`[SignIn:${reqId}] Sign in successful`, {
            userId: data.user?.id,
            email: data.user?.email,
            duration,
          });
        }

        // Redirect to dashboard
        router.push("/dashboard");
      } else {
        // No session - should not happen with signInWithPassword, but handle it
        setError({
          message: "Sign in successful but no session was created. Please try again.",
          code: "NO_SESSION",
          actionType: 'none',
        });
        setIsLoading(false);
      }

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const mappedError = mapSupabaseError(error);

      const debugText = `Request ID: ${reqId}\nStep: signin\nStatus: exception\nError Code: ${mappedError.code}\nError Message: ${error.message || String(error)}\nDuration: ${duration}ms\nSupabase URL: ${getSupabaseHostname()}\nSupabase Key (masked): ${maskSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'not-set')}`;
      setDebugInfo(debugText);

      if (isDev) {
        console.debug(`[SignIn:${reqId}] Sign in exception`, {
          error: error.message || error,
          duration,
        });
      }

      setError(mappedError);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex items-center justify-center">
            <h1 className="text-3xl font-bold text-blue-600">PharmaPulse AI</h1>
          </div>
          <p className="text-center text-gray-600">India's first AI-powered pharmacy management platform</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-center">Sign In</CardTitle>
            <CardDescription className="text-center">Enter your credentials to access your account</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {/* Error message with action hints */}
              {error && (
                <div className={`rounded-md border p-3 text-sm ${
                  error.code === 'RESEND_SUCCESS' 
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <div className="flex items-start gap-2">
                    <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      error.code === 'RESEND_SUCCESS' ? 'text-green-600' : 'text-red-600'
                    }`} />
                    <div className="flex-1 space-y-2">
                      <p className="font-medium">{error.message}</p>
                      {error.hint && (
                        <p className="text-xs opacity-90">{error.hint}</p>
                      )}
                      {error.actionType === 'resend' && (
                        <button
                          type="button"
                          onClick={handleResendVerification}
                          disabled={isResending}
                          className="text-xs font-medium underline hover:no-underline disabled:opacity-50"
                        >
                          {isResending ? "Sending..." : error.actionHint || "Resend verification email"}
                        </button>
                      )}
                      {error.actionType === 'reset' && (
                        <a
                          href={`/auth/reset?email=${encodeURIComponent(email)}`}
                          className="text-xs font-medium underline hover:no-underline"
                        >
                          {error.actionHint || "Reset password"}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Supabase config status (dev only) */}
              {isDev && configStatus && (
                <div className="rounded-md bg-gray-50 border border-gray-200 p-2 text-xs text-gray-600">
                  {configStatus.ok && configStatus.urlHost ? (
                    <span>Supabase host: {configStatus.urlHost}</span>
                  ) : (
                    <span>Missing: {configStatus.missing.join(', ')}</span>
                  )}
                </div>
              )}

              {/* Debug info (dev only) */}
              {isDev && debugInfo && (
                <div className="rounded-md bg-gray-50 border border-gray-200 p-2 text-xs text-gray-600 font-mono">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">Debug Info (Dev Only)</span>
                    <button
                      type="button"
                      onClick={copyDebugInfo}
                      className="flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap text-xs">{debugInfo}</pre>
                </div>
              )}

              {/* Email field */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter your email"
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium">
                    Password
                  </label>
                  <a 
                    href={`/auth/reset${email ? `?email=${encodeURIComponent(email)}` : ''}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-md border border-gray-300 p-2 pr-10 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Enter your password"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                disabled={isLoading || isResending}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  "Sign In"
                )}
              </Button>
              <div className="text-center text-sm text-gray-600">
                Don't have an account?{" "}
                <a 
                  href="/register" 
                  className="text-blue-600 hover:underline font-medium"
                >
                  Create Account
                </a>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}