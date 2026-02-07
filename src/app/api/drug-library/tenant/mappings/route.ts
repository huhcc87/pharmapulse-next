import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Query schema
const querySchema = z.object({
  tenantId: z.coerce.number().int(),
  localProductId: z.coerce.number().int().optional(),
  branchId: z.coerce.number().int().optional(),
});

// GET /api/drug-library/tenant/mappings
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const validated = querySchema.parse({
      tenantId: searchParams.get('tenantId'),
      localProductId: searchParams.get('localProductId'),
      branchId: searchParams.get('branchId'),
    });

    const where: any = {
      tenantId: validated.tenantId,
    };

    if (validated.localProductId) {
      where.localProductId = validated.localProductId;
    }

    if (validated.branchId) {
      where.branchId = validated.branchId;
    }

    const mappings = await prisma.tenantProductMap.findMany({
      where,
      include: {
        pack: {
          include: {
            brand: {
              include: {
                formulation: {
                  include: {
                    molecules: {
                      include: { molecule: true },
                    },
                  },
                },
                manufacturer: true,
              },
            },
          },
        },
        brand: {
          include: {
            formulation: {
              include: {
                molecules: {
                  include: { molecule: true },
                },
              },
            },
            manufacturer: true,
          },
        },
        formulation: {
          include: {
            molecules: {
              include: { molecule: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(mappings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error fetching mappings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch mappings' },
      { status: 500 }
    );
  }
}

