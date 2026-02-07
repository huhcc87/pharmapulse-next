import { NextResponse } from "next/server";
import { getSupabaseServerConfigStatus } from "@/lib/supabase/server";

/**
 * API Route: Supabase Health Check
 * 
 * Checks if Supabase is properly configured without making database queries.
 * Useful for deployment health checks and debugging.
 * 
 * @returns Configuration status
 */
export async function GET() {
  try {
    const status = getSupabaseServerConfigStatus();

    if (!status.ok) {
      return NextResponse.json(
        {
          status: "error",
          message: "Supabase configuration incomplete",
          missing: status.missing,
          hasServiceRole: status.hasServiceRole,
          urlHost: status.urlHost,
        },
        { status: 503 } // Service Unavailable
      );
    }

    return NextResponse.json({
      status: "healthy",
      message: "Supabase is properly configured",
      hasServiceRole: status.hasServiceRole,
      urlHost: status.urlHost,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Unknown error",
        type: error.constructor.name,
      },
      { status: 500 }
    );
  }
}
