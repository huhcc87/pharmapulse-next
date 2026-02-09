// src/app/api/supabase/list/router.ts

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * API Route: List products from Supabase
 *
 * This route uses the server-side Supabase client (RLS applies).
 * Fixes TS "relation: never" by ensuring the client is not typed with an empty Database schema.
 *
 * Long-term best practice:
 *   - Generate Supabase types and type createServerClient<Database>()
 * For now:
 *   - Cast to a generic SupabaseClient to unblock builds.
 */
export async function GET() {
  try {
    const supabase = createServerClient() as unknown as SupabaseClient;

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[API /api/supabase/list] Supabase error:", error);
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          code: (error as any).code,
          hint: (error as any).hint,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      count: Array.isArray(data) ? data.length : 0,
      data: data ?? [],
    });
  } catch (error: any) {
    console.error("[API /api/supabase/list] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Internal server error",
        type: error?.constructor?.name || "Error",
      },
      { status: 500 }
    );
  }
}
