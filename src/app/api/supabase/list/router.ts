import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * API Route: List products from Supabase
 * 
 * This route demonstrates proper server-side Supabase client usage.
 * Uses the server client which respects RLS policies.
 */
export async function GET() {
  try {
    const supabase = createServerClient();
    
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
          code: error.code,
          hint: error.hint,
        }, 
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      ok: true, 
      count: data?.length ?? 0, 
      data: data ?? [] 
    });
  } catch (error: any) {
    console.error("[API /api/supabase/list] Error:", error);
    return NextResponse.json(
      { 
        ok: false, 
        error: error.message || "Internal server error",
        type: error.constructor.name,
      }, 
      { status: 500 }
    );
  }
}
