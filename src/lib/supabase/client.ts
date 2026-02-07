/**
 * Supabase Client Helper - Single Source of Truth
 * 
 * This ensures both signup and signin use the same Supabase project.
 * 
 * Configuration:
 * - NEXT_PUBLIC_SUPABASE_URL: Your Supabase project URL (e.g., https://xyz.supabase.co)
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Your Supabase anon/public key
 * 
 * Email Confirmation Setup:
 * 1. Go to Supabase Dashboard → Authentication → URL Configuration
 * 2. Add redirect URLs:
 *    - http://localhost:3000/auth/callback (for dev)
 *    - https://yourdomain.com/auth/callback (for production)
 * 3. Enable "Enable email confirmations" in Authentication → Settings
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get environment variables (don't throw during module load - validate on use)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Extract hostname for status (gracefully handle missing URL)
let urlHostname: string | undefined = undefined;
try {
  if (supabaseUrl && typeof supabaseUrl === 'string' && supabaseUrl.startsWith('http')) {
    urlHostname = new URL(supabaseUrl).hostname;
  }
} catch (e) {
  // Invalid URL format
  urlHostname = undefined;
}

/**
 * Get Supabase configuration status
 * @returns { ok: boolean, missing: string[], urlHost?: string }
 */
export function getSupabaseConfigStatus(): { ok: boolean; missing: string[]; urlHost?: string } {
  const missing: string[] = [];
  if (!supabaseUrl || supabaseUrl.trim() === '') {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!supabaseAnonKey || supabaseAnonKey.trim() === '') {
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return {
    ok: missing.length === 0,
    missing,
    urlHost: urlHostname,
  };
}

// Create Supabase client instance (null if not configured)
let supabaseInstance: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        // Note: redirectTo is handled via URL parameters, not in config
      },
    });
  } catch (e) {
    // Failed to create client - keep as null
    supabaseInstance = null;
  }
}

// Export singleton supabase instance (null if not configured)
export const supabase = supabaseInstance;

/**
 * Create Supabase client for browser/client-side use
 * @deprecated Use the exported `supabase` singleton instead. This function throws if not configured.
 */
export function createBrowserClient() {
  if (!supabase) {
    const status = getSupabaseConfigStatus();
    const errorMsg = `Missing Supabase environment variables: ${status.missing.join(', ')}. Please set these in your .env.local file.`;
    throw new Error(errorMsg);
  }
  return supabase;
}

/**
 * Create Supabase client for server-side use
 * @deprecated Use createServerClient from '@/lib/supabase/server' instead
 * This function is kept for backward compatibility but may be removed in future versions.
 * 
 * For server-side operations, import from '@/lib/supabase/server':
 * ```ts
 * import { createServerClient } from '@/lib/supabase/server';
 * ```
 */
export function createServerClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    );
  }
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get Supabase URL hostname for dev logging
 * @deprecated Use getSupabaseConfigStatus().urlHost instead
 */
export function getSupabaseHostname(): string {
  return urlHostname || 'not-configured';
}

/**
 * Mask Supabase anon key for safe logging
 */
export function maskSupabaseKey(key: string): string {
  if (!key) return 'not-set';
  return `${key.substring(0, 20)}...${key.substring(key.length - 4)}`;
}

/**
 * Get browser client (for backward compatibility)
 * @deprecated Use the exported `supabase` singleton instead
 */
export function getBrowserClient() {
  if (typeof window === 'undefined') {
    throw new Error('getBrowserClient can only be called in browser/client components');
  }
  return createBrowserClient();
}