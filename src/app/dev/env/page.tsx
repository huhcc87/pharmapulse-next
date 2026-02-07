/**
 * Dev Environment Variables Check Page
 * 
 * Only accessible in development mode.
 * Shows Supabase environment variable status.
 */

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseConfigStatus } from "@/lib/supabase/client";

export default function DevEnvPage() {
  const [status, setStatus] = useState<{ ok: boolean; missing: string[]; urlHost?: string } | null>(null);
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    // Only show in development
    if (typeof window !== 'undefined') {
      const isDevelopment = window.location.hostname === 'localhost' || process.env.NODE_ENV === 'development';
      setIsDev(isDevelopment);
      
      if (isDevelopment) {
        const configStatus = getSupabaseConfigStatus();
        setStatus(configStatus);
      }
    }
  }, []);

  // Don't render in production
  if (!isDev) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Not Available</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This page is only available in development mode.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get status from the helper function (works on both client and server)
  const urlPresent = status ? !status.missing.includes('NEXT_PUBLIC_SUPABASE_URL') : false;
  const keyPresent = status ? !status.missing.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY') : false;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Environment Variables Status</CardTitle>
          <CardDescription>Development only - Supabase configuration check</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-md border">
              <span className="font-medium">NEXT_PUBLIC_SUPABASE_URL</span>
              <span className={urlPresent ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                {urlPresent ? "✓ Present" : "✗ Missing"}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-md border">
              <span className="font-medium">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
              <span className={keyPresent ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                {keyPresent ? "✓ Present" : "✗ Missing"}
              </span>
            </div>
          </div>

          {status && (
            <div className="p-4 rounded-md bg-gray-50 border">
              <h3 className="font-semibold mb-2">Configuration Status</h3>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="font-medium">Status: </span>
                  <span className={status.ok ? "text-green-600" : "text-red-600"}>
                    {status.ok ? "Configured ✓" : "Not Configured ✗"}
                  </span>
                </div>
                {status.urlHost && (
                  <div>
                    <span className="font-medium">Supabase URL Host: </span>
                    <span className="font-mono">{status.urlHost}</span>
                  </div>
                )}
                {status.missing.length > 0 && (
                  <div>
                    <span className="font-medium">Missing Variables: </span>
                    <span className="text-red-600">{status.missing.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {status && !status.ok && (
            <div className="p-4 rounded-md bg-yellow-50 border border-yellow-200">
              <h3 className="font-semibold mb-2 text-yellow-800">Setup Instructions</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-700">
                <li>Get values from: Supabase Dashboard → Project Settings → API</li>
                <li>Create <code className="bg-yellow-100 px-1 rounded">.env.local</code> in project root (same level as package.json)</li>
                <li>Add the variables:</li>
                <li className="ml-4">
                  <code className="bg-yellow-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL=your-url</code>
                </li>
                <li className="ml-4">
                  <code className="bg-yellow-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key</code>
                </li>
                <li>Restart the dev server (npm run dev)</li>
              </ol>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}