/**
 * Dev-only API route to check database schema consistency
 * GET /api/admin/schema-check
 */
import { NextRequest, NextResponse } from 'next/server';
import { checkInventoryItemsMrpColumn } from '@/lib/db/schema-check';

export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Schema check not available in production' },
      { status: 403 }
    );
  }

  try {
    const result = await checkInventoryItemsMrpColumn();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Schema check error:', error);
    return NextResponse.json(
      {
        columnExists: false,
        error: error instanceof Error ? error.message : String(error),
        message: 'Schema check failed',
      },
      { status: 500 }
    );
  }
}
