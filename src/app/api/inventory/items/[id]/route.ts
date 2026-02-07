import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Update schema
const updateInventoryItemSchema = z.object({
  qtyOnHand: z.number().int().min(0).optional(),
  reorderLevel: z.number().int().min(0).optional(),
  expiryDate: z.string().datetime().optional().nullable(),
  purchasePrice: z.number().min(0).optional().nullable(),
  sellingPrice: z.number().min(0).optional().nullable(),
  batchCode: z.string().optional().nullable(),
  tenantId: z.number().int().positive(),
  branchId: z.number().int().positive().optional().nullable(),
});

// PUT /api/inventory/items/[id] - Update inventory item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid inventory item ID' }, { status: 400 });
    }

    const body = await request.json();
    const validated = updateInventoryItemSchema.parse(body);

    // Check if inventory item exists
    // Using explicit select to avoid errors if mrp column doesn't exist yet
    const existingItem = await prisma.inventoryItem.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        branchId: true,
        drugLibraryId: true,
        qtyOnHand: true,
        reorderLevel: true,
        expiryDate: true,
        purchasePrice: true,
        sellingPrice: true,
        batchCode: true,
        batchId: true,
        createdAt: true,
        updatedAt: true,
        drugLibrary: {
          select: {
            id: true,
            brandName: true,
            manufacturer: true,
            qrCode: true,
          },
        },
        // mrp field handled safely via type casting below
      },
    });

    if (!existingItem) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
    }

    // Update inventory item
    // Using explicit select to avoid errors if mrp column doesn't exist yet
    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        qtyOnHand: validated.qtyOnHand ?? existingItem.qtyOnHand,
        reorderLevel: validated.reorderLevel ?? existingItem.reorderLevel,
        expiryDate: validated.expiryDate ? new Date(validated.expiryDate) : existingItem.expiryDate,
        purchasePrice: validated.purchasePrice ?? existingItem.purchasePrice,
        sellingPrice: validated.sellingPrice ?? existingItem.sellingPrice,
        batchCode: validated.batchCode ?? existingItem.batchCode,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        tenantId: true,
        branchId: true,
        drugLibraryId: true,
        qtyOnHand: true,
        reorderLevel: true,
        expiryDate: true,
        purchasePrice: true,
        sellingPrice: true,
        batchCode: true,
        batchId: true,
        createdAt: true,
        updatedAt: true,
        drugLibrary: {
          select: {
            id: true,
            brandName: true,
            manufacturer: true,
            qrCode: true,
          },
        },
        // mrp field handled safely via type casting below
      },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          tenantId: validated.tenantId,
          branchId: validated.branchId || null,
          action: 'UPDATE',
          entity: 'INVENTORY_ITEM',
          entityId: updated.id,
          beforeJson: JSON.stringify({
            qtyOnHand: existingItem.qtyOnHand,
            reorderLevel: existingItem.reorderLevel,
            purchasePrice: existingItem.purchasePrice,
            sellingPrice: existingItem.sellingPrice,
          }),
          afterJson: JSON.stringify({
            qtyOnHand: updated.qtyOnHand,
            reorderLevel: updated.reorderLevel,
            purchasePrice: updated.purchasePrice,
            sellingPrice: updated.sellingPrice,
          }),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    return NextResponse.json({
      success: true,
      inventoryItem: {
        id: updated.id,
        drugLibraryId: updated.drugLibraryId,
        brandName: updated.drugLibrary.brandName,
        manufacturer: updated.drugLibrary.manufacturer,
        qrCode: updated.drugLibrary.qrCode,
        qtyOnHand: updated.qtyOnHand,
        reorderLevel: updated.reorderLevel,
        expiryDate: updated.expiryDate,
        purchasePrice: updated.purchasePrice,
        sellingPrice: updated.sellingPrice,
        batchCode: updated.batchCode,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating inventory item:', error);
    return NextResponse.json(
      { error: 'Failed to update inventory item' },
      { status: 500 }
    );
  }
}

// DELETE /api/inventory/items/[id] - Delete inventory item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid inventory item ID' }, { status: 400 });
    }

    const existingItem = await prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
    }

    await prisma.inventoryItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Inventory item deleted' });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    return NextResponse.json(
      { error: 'Failed to delete inventory item' },
      { status: 500 }
    );
  }
}

