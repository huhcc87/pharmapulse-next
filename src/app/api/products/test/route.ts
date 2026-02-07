import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * API Route: Smoke test for Supabase connection
 * 
 * This endpoint tests:
 * 1. Supabase connection and authentication
 * 2. Database write operation (INSERT)
 * 3. Database read operation (SELECT)
 * 
 * Use this to verify your Supabase setup is working correctly.
 * 
 * Note: This requires a "products" table to exist in your Supabase database.
 * See SUPABASE_SETUP.md for table creation SQL.
 */
export async function GET() {
  try {
    const supabase = createServerClient();

    // Step 1: Insert test row
    // Note: Using 'any' type for insert until proper database types are generated
    const insertResult = await (supabase as any)
      .from("products")
      .insert({
        brand_name: "TEST PRODUCT",
        manufacturer: "TEST",
        category: "TEST",
        pack_size: "1",
        mrp: 100,
        unit_price: 90,
        barcode: `TEST-${Date.now()}`, // Unique barcode to avoid conflicts
      })
      .select("*")
      .single();

    if (insertResult.error) {
      return NextResponse.json(
        { 
          ok: false, 
          step: "insert", 
          error: insertResult.error.message,
          code: insertResult.error.code,
          hint: insertResult.error.hint,
          details: "This usually means the 'products' table doesn't exist or RLS policies are blocking the insert. See SUPABASE_SETUP.md for setup instructions.",
        },
        { status: 500 }
      );
    }

    // Step 2: Read latest rows
    // Note: Using 'any' type for select until proper database types are generated
    const readResult = await (supabase as any)
      .from("products")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (readResult.error) {
      return NextResponse.json(
        { 
          ok: false, 
          step: "read", 
          error: readResult.error.message,
          code: readResult.error.code,
          hint: readResult.error.hint,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Supabase connection test successful!",
      inserted: insertResult.data,
      latest: readResult.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[API /api/products/test] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
        type: error.constructor.name,
        details: error.message.includes("Missing required environment variable")
          ? "Check your .env.local file and ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set."
          : "See server logs for more details.",
      },
      { status: 500 }
    );
  }
}
