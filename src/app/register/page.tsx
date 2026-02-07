/**
 * Registration Page - Production-Ready with Timeout & Error Handling
 * 
 * DevTools:
 * - Network tab: Look for /api/auth/register request and response
 * - Console tab: Look for [Register] prefixed debug logs (dev only)
 * - Copy requestId from error messages to debug server-side issues
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, Copy, Mail } from "lucide-react";
import { supabase, getSupabaseConfigStatus, getSupabaseHostname, maskSupabaseKey } from "@/lib/supabase/client";

const TIMEOUT_MS = 25000; // 25 second timeout
const PASSWORD_MIN_LENGTH = 8;

interface RegistrationStep {
  name: string;
  label: string;
}

const REGISTRATION_STEPS: RegistrationStep[] = [
  { name: 'validating', label: 'Validating form...' },
  { name: 'signup', label: 'Creating account...' },
  { name: 'profile', label: 'Setting up profile...' },
  { name: 'redirect', label: 'Redirecting to dashboard...' },
];

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function calculatePasswordStrength(password: string): { score: number; feedback: string } {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { score: 0, feedback: `At least ${PASSWORD_MIN_LENGTH} characters` };
  }
  
  let score = 1;
  const hasNumber = /\d/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  if (hasNumber) score++;
  if (hasUpper && hasLower) score++;
  if (hasSpecial) score++;
  if (password.length >= 12) score++;
  
  if (score < 2) return { score, feedback: 'Weak - add numbers' };
  if (score < 3) return { score, feedback: 'Fair - add uppercase & lowercase' };
  if (score < 4) return { score, feedback: 'Good - add special characters' };
  return { score, feedback: 'Strong password' };
}

function sanitizeForLogging(data: any): any {
  const sanitized = { ...data };
  if (sanitized.password) delete sanitized.password;
  if (sanitized.confirmPassword) delete sanitized.confirmPassword;
  return sanitized;
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<RegistrationStep | null>(null);
  const [requestId, setRequestId] = useState<string>("");
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [configStatus, setConfigStatus] = useState<{ ok: boolean; missing: string[]; urlHost?: string } | null>(null);
  
  const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const submitTimestampRef = useRef<number>(0);

  // Debounce submit to prevent double submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate password strength
  const passwordStrength = password ? calculatePasswordStrength(password) : null;

  // Check Supabase configuration on mount
  useEffect(() => {
    const status = getSupabaseConfigStatus();
    setConfigStatus(status);
    
    if (!status.ok) {
      setError("Authentication service is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart the dev server.");
    }
  }, []);

  // Prevent double submit
  useEffect(() => {
    if (isLoading && submitButtonRef.current) {
      submitButtonRef.current.disabled = true;
    }
  }, [isLoading]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!name.trim()) {
      errors.name = "Name is required";
    } else if (name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters";
    }

    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      errors.email = "Enter a valid email address";
    }

    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < PASSWORD_MIN_LENGTH) {
      errors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
    } else if (!/\d/.test(password)) {
      errors.password = "Password must contain at least one number";
    } else if (passwordStrength && passwordStrength.score < 2) {
      errors.password = "Password is too weak. Please use a stronger password.";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    // Bot protection: honeypot check
    if (honeypotRef.current?.value) {
      errors._bot = "Invalid submission";
    }

    // Rate limiting: prevent too-fast submissions
    const now = Date.now();
    if (submitTimestampRef.current && now - submitTimestampRef.current < 2000) {
      errors._rateLimit = "Please wait before submitting again";
    }
    submitTimestampRef.current = now;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const copyDebugInfo = () => {
    if (debugInfo) {
      navigator.clipboard.writeText(debugInfo);
      alert('Debug info copied to clipboard!');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setHasTimedOut(false);
    setDebugInfo("");

    // Validation
    if (!validateForm()) {
      return;
    }

    // Prevent double submit
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setIsLoading(true);
    setCurrentStep(REGISTRATION_STEPS[0]); // validating

    const reqId = generateRequestId();
    setRequestId(reqId);
    const startTime = Date.now();

    // Dev logging
    if (isDev) {
      console.debug(`[Register:${reqId}] Starting registration`, {
        email: email.trim().toLowerCase(),
        timestamp: new Date().toISOString(),
        step: 'validating',
      });
    }

    // Step 0: Check if Supabase is configured FIRST (before creating any timers)
    if (!supabase) {
      const errorMsg = "Authentication service is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart the dev server.";
      setError(errorMsg);
      setDebugInfo(`Request ID: ${reqId}\nError: Supabase not configured\nPlease add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local\nThen restart the dev server (npm run dev)`);
      setIsLoading(false);
      setIsSubmitting(false);
      setCurrentStep(null);
      return; // Exit early - no timers created
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();

    // Create AbortController for timeout (only if Supabase is configured)
    const abortController = new AbortController();
    let timeoutId: NodeJS.Timeout | null = null;

    try {

      // Step 2: Call Supabase signup (only if configured)
      setCurrentStep(REGISTRATION_STEPS[1]); // signup
      
      if (isDev) {
        console.debug(`[Register:${reqId}] Step 1: Calling Supabase signup`, {
          supabaseHostname: getSupabaseHostname(),
        });
      }

      // Set up timeout AFTER Supabase check
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          abortController.abort();
          reject(new Error('TIMEOUT'));
        }, TIMEOUT_MS);
      });
      
      const signupPromise = supabase!.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: normalizedName,
          },
          emailRedirectTo: typeof window !== 'undefined' 
            ? `${window.location.origin}/auth/callback`
            : undefined,
        },
      });

      // Race against timeout
      let signupData, signupError;
      try {
        const result = await Promise.race([
          signupPromise,
          timeoutPromise,
        ]);
        
        // Clear timeout since signup completed
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        // Extract data and error from result
        signupData = result.data;
        signupError = result.error;
      } catch (raceError: any) {
        // Clear timeout in case of error
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        // Handle timeout or other race errors
        if (raceError.message === 'TIMEOUT') {
          throw raceError; // Re-throw timeout to be handled by outer catch
        }
        // For other errors, try to extract from error object
        signupError = raceError;
        signupData = null;
      }

      const fetchDuration = Date.now() - startTime;

      if (isDev) {
        console.debug(`[Register:${reqId}] Step 1 complete: Supabase signup response`, {
          hasError: !!signupError,
          hasSession: !!signupData?.session,
          hasUser: !!signupData?.user,
          duration: fetchDuration,
        });
      }

      // Handle Supabase errors
      if (signupError) {
        const errorMsg = signupError.message || 'Registration failed. Please try again.';
        const errorCode = signupError.status?.toString() || 'SIGNUP_ERROR';
        
        // Map Supabase errors
        let userFriendlyError = errorMsg;
        let showAccountExistsCTA = false;
        
        if (
          errorMsg.toLowerCase().includes('user already registered') ||
          errorMsg.toLowerCase().includes('already registered') ||
          errorMsg.toLowerCase().includes('email already exists') ||
          errorMsg.toLowerCase().includes('user already exists')
        ) {
          userFriendlyError = "This email is already registered.";
          showAccountExistsCTA = true;
        } else if (errorMsg.toLowerCase().includes('invalid email')) {
          userFriendlyError = "Enter a valid email address.";
        } else if (errorMsg.toLowerCase().includes('password')) {
          userFriendlyError = `Password must be at least ${PASSWORD_MIN_LENGTH} characters and contain at least one number.`;
        } else if (errorMsg.toLowerCase().includes('network') || errorMsg.toLowerCase().includes('fetch')) {
          userFriendlyError = "Network issue. Please check your connection and try again.";
        }

        const debugInfoText = `Request ID: ${reqId}\nStep: signup\nError Code: ${errorCode}\nStatus: ${signupError.status || 'error'}\nError Message: ${signupError.message}\nDuration: ${fetchDuration}ms\nSupabase URL: ${getSupabaseHostname()}\nSupabase Key (masked): ${maskSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'not-set')}`;
        setDebugInfo(debugInfoText);

        if (isDev) {
          console.debug(`[Register:${reqId}] Step 2 FAILED: Supabase signup error`, {
            error: signupError.message,
            code: signupError.status,
            duration: fetchDuration,
          });
        }

        // Store account exists flag for UI
        if (showAccountExistsCTA) {
          setError(userFriendlyError);
          setFieldErrors({ _accountExists: 'true' }); // Flag for UI
          setIsLoading(false);
          setIsSubmitting(false);
          setCurrentStep(null);
          return; // Don't throw - show CTA instead
        }

        throw new Error(userFriendlyError);
      }

      // Step 2: Handle email confirmation vs immediate session
      setCurrentStep(REGISTRATION_STEPS[2]); // profile
      
      if (!signupData?.session) {
        // Email confirmation required
        if (isDev) {
          console.debug(`[Register:${reqId}] Step 2: Email confirmation required`, {
            userId: signupData?.user?.id,
            email: normalizedEmail,
          });
        }

        // Redirect to check-email page
        router.push(`/check-email?email=${encodeURIComponent(normalizedEmail)}`);
        return;
      }

      // Session exists - signup successful, redirect to dashboard
      const totalDuration = Date.now() - startTime;

      if (isDev) {
        console.debug(`[Register:${reqId}] Step 3: Registration successful with session`, {
          userId: signupData.user?.id,
          email: normalizedEmail,
          duration: totalDuration,
          step: 'redirect',
        });
      }

      // Step 4: Redirect
      setCurrentStep(REGISTRATION_STEPS[3]); // redirect
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UX
      
      // Use window.location for reliable redirect (avoids router.push hanging)
      window.location.href = '/dashboard';

    } catch (error: any) {
      // Clear timeout in case of error
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      const totalDuration = Date.now() - startTime;
      const elapsedSeconds = (totalDuration / 1000).toFixed(1);

      // Determine error type and message
      let errorMessage = "An error occurred. Please try again.";
      let errorCode = "UNKNOWN_ERROR";

      if (error.name === 'AbortError' || error.message === 'TIMEOUT') {
        errorMessage = "Registration request timed out. Please check your internet connection and try again.";
        errorCode = "TIMEOUT";
        setHasTimedOut(true);
      } else if (error.message && (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch'))) {
        errorMessage = "Network error. Please check your internet connection and try again.";
        errorCode = "NETWORK_ERROR";
      } else if (error.message) {
        errorMessage = error.message;
        errorCode = "API_ERROR";
      }

      // Build debug info
      const debugInfoText = `Request ID: ${reqId}\nStep: ${currentStep?.name || 'unknown'}\nError Code: ${errorCode}\nDuration: ${elapsedSeconds}s\nError: ${error.message || error}\nSupabase URL: ${getSupabaseHostname()}\nSupabase Key (masked): ${maskSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'not-set')}`;
      setDebugInfo(debugInfoText);

      if (isDev) {
        console.debug(`[Register:${reqId}] Registration FAILED`, {
          error: sanitizeForLogging({ 
            message: error.message, 
            name: error.name,
            code: errorCode 
          }),
          duration: totalDuration,
          step: currentStep?.name,
          timestamp: new Date().toISOString(),
        });
      }

      setError(errorMessage);
      setCurrentStep(null);

    } finally {
      // ALWAYS reset loading state - critical for preventing infinite loaders
      setIsLoading(false);
      setIsSubmitting(false);
      setCurrentStep(null);
      
      // Re-enable submit button after a brief delay
      setTimeout(() => {
        if (submitButtonRef.current) {
          submitButtonRef.current.disabled = false;
        }
      }, 1000);
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
            <CardTitle className="text-center">Create Account</CardTitle>
            <CardDescription className="text-center">
              Sign up to get started with PharmaPulse AI
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {/* Error message */}
              {error && (
                <div className={`rounded-md border p-3 text-sm ${
                  error.includes('already registered') || fieldErrors._accountExists
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <p className="font-medium">{error}</p>
                      
                      {/* Account exists CTA */}
                      {(error.includes('already registered') || fieldErrors._accountExists) && (
                        <div className="space-y-2 mt-2">
                          <div className="flex flex-col gap-2">
                            <a
                              href="/login"
                              className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                              Sign in instead
                            </a>
                            <a
                              href={`/auth/reset?email=${encodeURIComponent(email)}`}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Forgot password?
                            </a>
                          </div>
                          <p className="text-xs opacity-90 mt-2">
                            If you signed up before, you may need to verify your email. 
                            <button
                              type="button"
                              onClick={async () => {
                                if (!supabase) {
                                  alert('Supabase is not configured. Please add environment variables to .env.local');
                                  return;
                                }
                                try {
                                  await supabase.auth.resend({
                                    type: 'signup',
                                    email: email.trim().toLowerCase(),
                                  });
                                  alert('Verification email sent! Check your inbox.');
                                } catch (e: any) {
                                  alert('Failed to resend email: ' + (e.message || 'Please try again.'));
                                }
                              }}
                              className="ml-1 text-blue-600 hover:underline font-medium"
                            >
                              Resend verification email
                            </button>
                          </p>
                        </div>
                      )}

                      {hasTimedOut && !fieldErrors._accountExists && (
                        <button
                          type="button"
                          onClick={() => {
                            setError("");
                            setHasTimedOut(false);
                            setIsLoading(false);
                          }}
                          className="mt-2 text-xs font-medium underline hover:no-underline"
                        >
                          Try again
                        </button>
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

              {/* Current step indicator */}
              {isLoading && currentStep && (
                <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{currentStep.label}</span>
                  </div>
                </div>
              )}

              {/* Bot protection honeypot (hidden) */}
              <input
                ref={honeypotRef}
                type="text"
                name="website"
                autoComplete="off"
                tabIndex={-1}
                style={{ position: 'absolute', left: '-9999px' }}
                aria-hidden="true"
              />

              {/* Name field */}
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: '' }));
                  }}
                  required
                  className={`w-full rounded-md border p-2 focus:outline-none focus:ring-1 ${
                    fieldErrors.name
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                  }`}
                  placeholder="Enter your full name"
                  disabled={isLoading}
                />
                {fieldErrors.name && (
                  <p className="text-xs text-red-600">{fieldErrors.name}</p>
                )}
              </div>

              {/* Email field */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
                  }}
                  required
                  className={`w-full rounded-md border p-2 focus:outline-none focus:ring-1 ${
                    fieldErrors.email
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                  }`}
                  placeholder="Enter your email"
                  disabled={isLoading}
                  autoComplete="email"
                />
                {fieldErrors.email && (
                  <p className="text-xs text-red-600">{fieldErrors.email}</p>
                )}
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-gray-600 hover:text-gray-800"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
                    }}
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    className={`w-full rounded-md border p-2 pr-10 focus:outline-none focus:ring-1 ${
                      fieldErrors.password
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                    placeholder={`Enter password (min ${PASSWORD_MIN_LENGTH} characters)`}
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                </div>
                {fieldErrors.password && (
                  <p className="text-xs text-red-600">{fieldErrors.password}</p>
                )}
                {password && passwordStrength && (
                  <div className="mt-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            passwordStrength.score < 2
                              ? 'bg-red-500 w-1/4'
                              : passwordStrength.score < 3
                              ? 'bg-yellow-500 w-1/2'
                              : passwordStrength.score < 4
                              ? 'bg-blue-500 w-3/4'
                              : 'bg-green-500 w-full'
                          }`}
                          style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">{passwordStrength.feedback}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-xs text-gray-600 hover:text-gray-800"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) setFieldErrors(prev => ({ ...prev, confirmPassword: '' }));
                  }}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  className={`w-full rounded-md border p-2 focus:outline-none focus:ring-1 ${
                    fieldErrors.confirmPassword
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : password && confirmPassword && password === confirmPassword
                      ? 'border-green-300 focus:border-green-500 focus:ring-green-500'
                      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                  }`}
                  placeholder="Confirm your password"
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                {fieldErrors.confirmPassword && (
                  <p className="text-xs text-red-600">{fieldErrors.confirmPassword}</p>
                )}
                {password && confirmPassword && password === confirmPassword && !fieldErrors.confirmPassword && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Passwords match
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button
                ref={submitButtonRef}
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                disabled={isLoading || isSubmitting}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{currentStep?.label || "Creating Account..."}</span>
                  </div>
                ) : hasTimedOut ? (
                  "Try Again"
                ) : (
                  "Create Account"
                )}
              </Button>
              <div className="text-center text-sm text-gray-600">
                Already have an account?{" "}
                <a
                  href="/login"
                  className="text-blue-600 hover:underline font-medium"
                >
                  Sign In
                </a>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}