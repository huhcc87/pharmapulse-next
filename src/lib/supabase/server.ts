/**
 * Supabase Server-Side Client
 * 
 * Use this in API routes, Server Components, and Server Actions.
 * 
 * IMPORTANT SECURITY NOTES:
 * - NEVER use service role key in client-side code
 * - Service role key bypasses Row Level Security (RLS)
 * - Only use service role key for admin operations or when RLS is not needed
 * - Use anon key for normal operations that respect RLS
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// If types are not defined yet, use any (update after generating types from Supabase)
type SupabaseDatabase = Database extends Database ? Database : any;

/**
 * Environment variable validation
 * Fails fast with helpful errors if required vars are missing
 */
function validateEnvVars() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || supabaseUrl.trim() === '') {
    throw new Error(
      'Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL\n' +
      'Get this from: Supabase Dashboard → Settings → API → Project URL'
    );
  }

  if (!supabaseAnonKey || supabaseAnonKey.trim() === '') {
    throw new Error(
      'Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY\n' +
      'Get this from: Supabase Dashboard → Settings → API → anon public key'
    );
  }

  // Validate URL format
  try {
    new URL(supabaseUrl);
  } catch {
    throw new Error(
      `Invalid NEXT_PUBLIC_SUPABASE_URL format: ${supabaseUrl}\n` +
      'Expected format: https://your-project-id.supabase.co'
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

/**
 * Create a Supabase client for server-side use with anon key
 * 
 * This client respects Row Level Security (RLS) policies.
 * Use for normal operations where RLS should be enforced.
 * 
 * @returns Supabase client instance
 * @throws Error if environment variables are missing or invalid
 * 
 * @example
 * ```ts
 * import { createServerClient } from '@/lib/supabase/server';
 * 
 * const supabase = createServerClient();
 * const { data, error } = await supabase.from('products').select('*');
 * ```
 */
export function createServerClient() {
  const { supabaseUrl, supabaseAnonKey } = validateEnvVars();

  return createClient<SupabaseDatabase>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Create a Supabase admin client with service role key
 * 
 * ⚠️ SECURITY WARNING: This client bypasses Row Level Security (RLS)!
 * 
 * Only use this for:
 * - Admin operations (user management, system maintenance)
 * - Operations that must bypass RLS
 * - Background jobs or cron tasks
 * 
 * NEVER expose this client to the browser or client-side code!
 * 
 * @returns Supabase admin client instance
 * @throws Error if service role key is missing
 * 
 * @example
 * ```ts
 * import { createAdminClient } from '@/lib/supabase/server';
 * 
 * const admin = createAdminClient();
 * // This bypasses RLS - use with caution!
 * const { data } = await admin.from('users').select('*');
 * ```
 */
export function createAdminClient() {
  const { supabaseUrl } = validateEnvVars();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey || serviceRoleKey.trim() === '') {
    throw new Error(
      'Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY\n' +
      'Get this from: Supabase Dashboard → Settings → API → service_role key\n' +
      '⚠️ Never use NEXT_PUBLIC prefix for service role key!\n' +
      '⚠️ Never commit this key to Git or expose it to the client!'
    );
  }

  return createClient<SupabaseDatabase>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Check if Supabase is properly configured
 * Returns status without throwing errors
 * 
 * @returns Configuration status object
 */
export function getSupabaseServerConfigStatus(): {
  ok: boolean;
  missing: string[];
  hasServiceRole: boolean;
  urlHost?: string;
} {
  const missing: string[] = [];
  let urlHost: string | undefined;

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url || url.trim() === '') {
      missing.push('NEXT_PUBLIC_SUPABASE_URL');
    } else {
      try {
        urlHost = new URL(url).hostname;
      } catch {
        missing.push('NEXT_PUBLIC_SUPABASE_URL (invalid format)');
      }
    }
  } catch {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim() === '') {
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  const hasServiceRole = !!(
    process.env.SUPABASE_SERVICE_ROLE_KEY && 
    process.env.SUPABASE_SERVICE_ROLE_KEY.trim() !== ''
  );

  return {
    ok: missing.length === 0,
    missing,
    hasServiceRole,
    urlHost,
  };
}
