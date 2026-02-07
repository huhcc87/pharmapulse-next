import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Drug Library validation schema - matches DrugLibrary model
const drugLibrarySchema = z.object({
  brandName: z.string().min(1),
  manufacturer: z.string().optional().nullable(),
  priceInr: z.string().optional().nullable(),
  isDiscontinued: z.boolean().optional().default(false),
  type: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  packSize: z.string().optional().nullable(),
  fullComposition: z.string().optional().nullable(),
  salts: z.string().optional().nullable(),
  composition1: z.string().optional().nullable(),
  composition2: z.string().optional().nullable(),
  gstPercent: z.number().optional().nullable(),
  schedule: z.string().optional().nullable(),
  rxOtc: z.string().optional().nullable(),
  dpcoCeilingPriceInr: z.number().optional().nullable(),
  qrCode: z.string().min(1),
  qrPayload: z.string().optional().default(''),
});

// GET /api/drug-library - Search drugs
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const barcode = searchParams.get('barcode');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (barcode) {
      // Search by barcode
      const drug = await prisma.drugLibrary.findFirst({
        where: { qrCode: barcode },
      });
      
      if (drug) {
        // Note: DrugLibrary model doesn't have searchCount field - removed update
      }
      
      return NextResponse.json(drug || null);
    }

    if (query && query.length >= 2) {
      // Search by query (brand name, generic name, salt composition, etc.)
      const queryLower = query.toLowerCase();
      const allDrugs = await prisma.drugLibrary.findMany({
        take: limit,
        orderBy: [
          { updatedAt: 'desc' },
        ],
      });

      const filteredDrugs = allDrugs.filter(drug => {
        const searchText = [
          drug.brandName,
          drug.salts,
          drug.fullComposition,
          drug.manufacturer,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchText.includes(queryLower);
      });

      // Update search counts for found drugs
      if (filteredDrugs.length > 0) {
        await prisma.drugLibrary.updateMany({
          where: {
            id: { in: filteredDrugs.map(d => d.id) },
          },
          data: {
          },
        });
      }

      return NextResponse.json(filteredDrugs);
    }

    // Get popular drugs (most searched)
    const popularDrugs = await prisma.drugLibrary.findMany({
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(popularDrugs);
  } catch (error) {
    console.error('Error fetching drug library:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drug library' },
      { status: 500 }
    );
  }
}

// POST /api/drug-library - Add or update drug in library
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = drugLibrarySchema.parse(body);

    // Check if drug with qrCode already exists
    if (validatedData.qrCode && validatedData.qrCode.trim() !== '') {
      const existing = await prisma.drugLibrary.findFirst({
        where: { qrCode: validatedData.qrCode },
      });

      if (existing) {
        // Update existing drug
        const updated = await prisma.drugLibrary.update({
          where: { id: existing.id },
          data: {
            ...validatedData,
            updatedAt: new Date(),
          },
        });
        return NextResponse.json(updated);
      }
    }

    // Check if similar drug exists (by brand name)
    const similar = await prisma.drugLibrary.findFirst({
      where: {
        brandName: validatedData.brandName,
      },
    });

    if (similar) {
      // Update existing similar drug
      const updated = await prisma.drugLibrary.update({
        where: { id: similar.id },
        data: {
          ...validatedData,
          updatedAt: new Date(),
        },
      });
      return NextResponse.json(updated);
    }

    // Create new drug entry - ensure qrCode and qrPayload are set
    const drug = await prisma.drugLibrary.create({
      data: {
        ...validatedData,
        qrCode: validatedData.qrCode || `INMED-${Date.now()}`,
        qrPayload: validatedData.qrPayload || JSON.stringify({ code: validatedData.qrCode || `INMED-${Date.now()}`, brandName: validatedData.brandName }),
      },
    });

    return NextResponse.json(drug, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating/updating drug library:', error);
    return NextResponse.json(
      { error: 'Failed to save drug to library' },
      { status: 500 }
    );
  }
}

