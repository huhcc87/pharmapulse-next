import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Alias schema
const aliasSchema = z.object({
  tenantId: z.number().int(),
  alias: z.string().min(1).max(200),
  aliasType: z.enum(['BRAND', 'FORMULATION', 'MOLECULE', 'BARCODE', 'HINDI', 'COMMON']),
  mappedPackId: z.number().int().optional(),
  mappedBrandId: z.number().int().optional(),
  mappedFormulationId: z.number().int().optional(),
  mappedMoleculeId: z.number().int().optional(),
  idempotencyKey: z.string().min(1),
});

// POST /api/drug-library/tenant/alias
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = aliasSchema.parse(body);

    // Check idempotency
    if (validated.idempotencyKey) {
      const existing = await prisma.tenantAlias.findUnique({
        where: { idempotencyKey: validated.idempotencyKey },
      });
      if (existing) {
        return NextResponse.json(existing);
      }
    }

    // Validate at least one mapping target
    if (!validated.mappedPackId && !validated.mappedBrandId && !validated.mappedFormulationId && !validated.mappedMoleculeId) {
      return NextResponse.json(
        { error: 'At least one mapping target is required' },
        { status: 400 }
      );
    }

    // Check if alias already exists for this tenant
    const existingAlias = await prisma.tenantAlias.findFirst({
      where: {
        tenantId: validated.tenantId,
        alias: validated.alias,
        aliasType: validated.aliasType,
      },
    });

    if (existingAlias) {
      // Update existing alias
      const updated = await prisma.tenantAlias.update({
        where: { id: existingAlias.id },
        data: {
          mappedPackId: validated.mappedPackId || null,
          mappedBrandId: validated.mappedBrandId || null,
          mappedFormulationId: validated.mappedFormulationId || null,
          mappedMoleculeId: validated.mappedMoleculeId || null,
          idempotencyKey: validated.idempotencyKey,
        },
      });
      return NextResponse.json(updated);
    }

    // Create new alias
    const alias = await prisma.tenantAlias.create({
      data: {
        tenantId: validated.tenantId,
        alias: validated.alias,
        aliasType: validated.aliasType,
        mappedPackId: validated.mappedPackId || null,
        mappedBrandId: validated.mappedBrandId || null,
        mappedFormulationId: validated.mappedFormulationId || null,
        mappedMoleculeId: validated.mappedMoleculeId || null,
        idempotencyKey: validated.idempotencyKey,
      },
    });

    return NextResponse.json(alias, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating tenant alias:', error);
    return NextResponse.json(
      { error: 'Failed to create alias' },
      { status: 500 }
    );
  }
}

