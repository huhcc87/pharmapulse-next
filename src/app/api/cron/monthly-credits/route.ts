/**
 * Monthly Credits Grant Cron Endpoint
 * 
 * GET /api/cron/monthly-credits
 * 
 * Protected by CRON_SECRET environment variable.
 * Call this endpoint from Vercel Cron or external scheduler.
 */

import { NextRequest, NextResponse } from "next/server";
import { grantMonthlyCreditsToAll } from "@/lib/billing/monthly-grant-cron";

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Grant credits to all eligible orgs
    const result = await grantMonthlyCreditsToAll();

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Monthly credits cron error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to grant monthly credits' },
      { status: 500 }
    );
  }
}
