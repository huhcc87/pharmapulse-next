import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Mapping schema
const mappingSchema = z.object({
  tenantId: z.number().int(),
  branchId: z.number().int().optional(),
  localProductId: z.number().int().optional(),
  mappedPackId: z.number().int().optional(),
  mappedBrandId: z.number().int().optional(),
  mappedFormulationId: z.number().int().optional(),
  source: z.enum(['MANUAL', 'IMPORT', 'OCR', 'BARCODE']),
  confidence: z.number().min(0).max(1).default(0.8),
  idempotencyKey: z.string().min(1),
});

// POST /api/drug-library/tenant/map
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = mappingSchema.parse(body);

    // Check idempotency
    if (validated.idempotencyKey) {
      const existing = await prisma.tenantProductMap.findUnique({
        where: { idempotencyKey: validated.idempotencyKey },
      });
      if (existing) {
        return NextResponse.json(existing);
      }
    }

    // Validate at least one mapping target
    if (!validated.mappedPackId && !validated.mappedBrandId && !validated.mappedFormulationId) {
      return NextResponse.json(
        { error: 'At least one mapping target (packId, brandId, or formulationId) is required' },
        { status: 400 }
      );
    }

    // Check unique constraint for tenantId + localProductId
    if (validated.localProductId) {
      const existingMap = await prisma.tenantProductMap.findUnique({
        where: {
          tenantId_localProductId: {
            tenantId: validated.tenantId,
            localProductId: validated.localProductId,
          },
        },
      });

      if (existingMap) {
        // Update existing mapping
        const updated = await prisma.tenantProductMap.update({
          where: { id: existingMap.id },
          data: {
            mappedPackId: validated.mappedPackId || null,
            mappedBrandId: validated.mappedBrandId || null,
            mappedFormulationId: validated.mappedFormulationId || null,
            source: validated.source,
            confidence: validated.confidence,
            idempotencyKey: validated.idempotencyKey,
            updatedAt: new Date(),
          },
        });
        return NextResponse.json(updated);
      }
    }

    // Create new mapping
    const mapping = await prisma.tenantProductMap.create({
      data: {
        tenantId: validated.tenantId,
        branchId: validated.branchId || null,
        localProductId: validated.localProductId || null,
        mappedPackId: validated.mappedPackId || null,
        mappedBrandId: validated.mappedBrandId || null,
        mappedFormulationId: validated.mappedFormulationId || null,
        source: validated.source,
        confidence: validated.confidence,
        idempotencyKey: validated.idempotencyKey,
      },
    });

    return NextResponse.json(mapping, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating tenant mapping:', error);
    return NextResponse.json(
      { error: 'Failed to create mapping' },
      { status: 500 }
    );
  }
}

