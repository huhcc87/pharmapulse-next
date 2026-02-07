import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Product update schema (all fields optional except id)
const productUpdateSchema = z.object({
  sku: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  barcode: z.string().optional().nullable(),
  category: z.string().min(1).optional(),
  manufacturer: z.string().optional().nullable(),
  composition: z.string().optional().nullable(),
  saltComposition: z.string().optional().nullable(),
  hsnCode: z.string().optional().nullable(),
  schedule: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  unitPrice: z.number().min(0).optional(),
  mrp: z.number().min(0).optional().nullable(),
  stockLevel: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
});

// GET /api/products/[id] - Get a single product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

// PUT /api/products/[id] - Update a product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = productUpdateSchema.parse(body);

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Check if SKU is being changed and already exists
    if (validatedData.sku && validatedData.sku !== existingProduct.sku) {
      const existingSku = await prisma.product.findUnique({
        where: { sku: validatedData.sku },
      });
      if (existingSku) {
        return NextResponse.json(
          { error: 'Product with this SKU already exists' },
          { status: 400 }
        );
      }
    }

    // Check if barcode is being changed and already exists
    if (validatedData.barcode !== undefined && validatedData.barcode !== existingProduct.barcode) {
      if (validatedData.barcode) {
        const existingBarcode = await prisma.product.findUnique({
          where: { barcode: validatedData.barcode },
        });
        if (existingBarcode) {
          return NextResponse.json(
            { error: 'Product with this barcode already exists' },
            { status: 400 }
          );
        }
      }
    }

    // Convert empty strings to null for optional fields
    const updateData = {
      ...validatedData,
      barcode: validatedData.barcode !== undefined && validatedData.barcode && validatedData.barcode.trim() !== '' ? validatedData.barcode : null,
      manufacturer: validatedData.manufacturer !== undefined && validatedData.manufacturer && validatedData.manufacturer.trim() !== '' ? validatedData.manufacturer : null,
      composition: validatedData.composition !== undefined && validatedData.composition && validatedData.composition.trim() !== '' ? validatedData.composition : null,
      saltComposition: validatedData.saltComposition !== undefined && validatedData.saltComposition && validatedData.saltComposition.trim() !== '' ? validatedData.saltComposition : null,
      hsnCode: validatedData.hsnCode !== undefined && validatedData.hsnCode && validatedData.hsnCode.trim() !== '' ? validatedData.hsnCode : null,
      schedule: validatedData.schedule !== undefined && validatedData.schedule && validatedData.schedule.trim() !== '' ? validatedData.schedule : null,
      description: validatedData.description !== undefined && validatedData.description && validatedData.description.trim() !== '' ? validatedData.description : null,
      mrp: validatedData.mrp !== undefined && validatedData.mrp && validatedData.mrp > 0 ? validatedData.mrp : null,
    };

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id] - Delete a product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    await prisma.product.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}

