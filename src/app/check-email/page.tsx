/**
 * Check Email Page - For Email Confirmation Flow
 * 
 * This page is shown after registration when email confirmation is required.
 * User is instructed to check their email and click the confirmation link.
 * 
 * URL: /check-email?email=<user-email>
 */

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams?.get('email') || null;
  const [emailSent, setEmailSent] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleResendEmail = async () => {
    if (!email) {
      alert('Please enter your email address first.');
      return;
    }
    
    setIsResending(true);
    setEmailSent(false);
    
    try {
      const { getBrowserClient } = await import('@/lib/supabase/client');
      const supabase = getBrowserClient();
      
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      });

      if (resendError) {
        alert(`Failed to resend email: ${resendError.message}`);
      } else {
        setEmailSent(true);
        setTimeout(() => setEmailSent(false), 5000);
      }
    } catch (error: any) {
      console.error('Failed to resend email:', error);
      alert(`Failed to resend email: ${error.message || 'Please try again.'}`);
    } finally {
      setIsResending(false);
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
            <CardTitle className="text-center flex items-center justify-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Check Your Email
            </CardTitle>
            <CardDescription className="text-center">
              We've sent you a confirmation email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
              <p className="mb-2 font-medium">
                Please check your email inbox and click the confirmation link to activate your account.
              </p>
              {email && (
                <p className="mb-2 text-xs text-blue-700">
                  <strong>Email sent to:</strong> {email}
                </p>
              )}
              <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-700">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium mb-1">Didn't receive the email?</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Check your spam/junk folder</li>
                      <li>Verify the email address is correct</li>
                      <li>Wait a few minutes and check again</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {emailSent && (
              <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmation email sent! Please check your inbox.</span>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              onClick={handleResendEmail}
              variant="outline"
              className="w-full"
              disabled={emailSent || isResending}
            >
              {isResending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending...</span>
                </div>
              ) : emailSent ? (
                'Email Sent!'
              ) : (
                'Resend Confirmation Email'
              )}
            </Button>
            <div className="text-center space-y-2">
              <Link 
                href="/login"
                className="text-blue-600 hover:underline font-medium text-sm block"
              >
                Back to Sign In
              </Link>
              <p className="text-xs text-gray-500">
                Already confirmed? <Link href="/login" className="text-blue-600 hover:underline">Sign in here</Link>
              </p>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <CheckEmailContent />
    </Suspense>
  );
}