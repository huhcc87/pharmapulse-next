import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/drug-library/health
export async function GET(request: NextRequest) {
  try {
    // Check if table exists and get row count
    const rowCount = await prisma.drugLibrary.count();

    // Get a sample row to check columns
    const sampleRow = await prisma.drugLibrary.findFirst({
      select: {
        id: true,
        brandName: true,
        qrCode: true,
        manufacturer: true,
        salts: true,
        fullComposition: true,
        packSize: true,
        category: true,
        priceInr: true,
        isDiscontinued: true,
      },
    });

    // Check if QR columns exist
    const hasQrColumns = sampleRow ? !!sampleRow.qrCode : false;

    return NextResponse.json({
      healthy: true,
      rowCount,
      hasQrColumns,
      sampleRow: sampleRow ? {
        brandName: sampleRow.brandName,
        qrCode: sampleRow.qrCode,
        manufacturer: sampleRow.manufacturer,
        salts: sampleRow.salts,
        fullComposition: sampleRow.fullComposition,
        packSize: sampleRow.packSize,
        category: sampleRow.category,
        priceInr: sampleRow.priceInr,
        isDiscontinued: sampleRow.isDiscontinued,
      } : null,
    });
  } catch (error: any) {
    console.error('Health check error:', error);
    return NextResponse.json({
      healthy: false,
      error: error.message || 'Database connection failed',
      rowCount: 0,
      hasQrColumns: false,
      sampleRow: null,
    }, { status: 500 });
  }
}

