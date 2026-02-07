/**
 * Get authenticated user from request (for API routes)
 * 
 * Uses the existing getSessionUser() function which reads from cookies.
 * The user specified Supabase auth, but the codebase currently uses cookie-based auth.
 * 
 * TODO: If migrating to full Supabase auth, install @supabase/ssr and use createRouteHandlerClient
 */

import { getSessionUser } from "@/lib/auth";

export async function getSupabaseUser() {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return null;
    }
    
    // Convert to expected format
    // Note: For Supabase DB, user_id should be UUID, but getSessionUser returns string userId
    // We'll use userId as-is, but you may need to adapt based on your auth migration
    return {
      id: user.userId, // Use userId (may need UUID conversion for Supabase)
      email: user.email,
      name: user.email.split('@')[0], // Fallback name
      tenantId: user.tenantId, // Keep for compatibility
    };
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}
