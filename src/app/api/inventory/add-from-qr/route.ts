/**
 * POST /api/inventory/add-from-qr
 * 
 * Adds a drug to inventory by scanning QR code.
 * 
 * IMPORTANT: After running migration, run these commands:
 * 1. npx prisma db pull          # Sync schema from database (optional)
 * 2. npx prisma generate         # Regenerate Prisma Client
 * 3. Restart server              # npm run dev or npm start
 * 
 * Migration file: prisma/migrations/add_mrp_to_inventory_items.sql
 */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Request body validation schema
const addFromQRSchema = z.object({
  code: z.string().min(1).max(200),
  qtyOnHand: z.number().int().min(0).default(0),
  reorderLevel: z.number().int().min(0).optional(),
  expiryDate: z.string().datetime().optional().nullable(),
  purchasePrice: z.number().min(0).optional().nullable(),
  sellingPrice: z.number().min(0).optional().nullable(),
  batchCode: z.string().optional().nullable(),
  tenantId: z.number().int().positive(),
  branchId: z.number().int().positive().optional().nullable(),
  userId: z.number().int().positive().optional(),
});

// Extract QR code from URL or raw code
function extractQRCode(input: string): string | null {
  const cleaned = input.trim();
  const match = cleaned.match(/INMED-(\d{6})/i);
  if (match) {
    return `INMED-${match[1].padStart(6, '0')}`;
  }
  if (/^INMED-\d{6}$/i.test(cleaned)) {
    return cleaned.toUpperCase();
  }
  return null;
}

// Calculate MRP from drug data - defaults to sellingPrice if missing
function calculateMrp(
  drug: { dpcoCeilingPriceInr?: number | null; priceInr?: string | null },
  sellingPrice?: number | null,
  purchasePrice?: number | null
): number | null {
  // If sellingPrice provided, use it as MRP
  if (sellingPrice != null && sellingPrice > 0) {
    return sellingPrice;
  }
  
  // Try dpcoCeilingPriceInr from drug library
  if (drug.dpcoCeilingPriceInr != null && typeof drug.dpcoCeilingPriceInr === 'number' && drug.dpcoCeilingPriceInr > 0) {
    return drug.dpcoCeilingPriceInr;
  }
  
  // Try parsing priceInr string
  if (drug.priceInr) {
    const priceStr = String(drug.priceInr).replace(/[^\d.]/g, '');
    const priceNum = parseFloat(priceStr);
    if (!isNaN(priceNum) && priceNum > 0) {
      return priceNum;
    }
  }
  
  // Fallback to purchasePrice if available
  if (purchasePrice != null && purchasePrice > 0) {
    return purchasePrice;
  }
  
  return null;
}

// POST /api/inventory/add-from-qr
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = addFromQRSchema.parse(body);

    const {
      code,
      qtyOnHand,
      reorderLevel,
      expiryDate,
      purchasePrice,
      sellingPrice,
      batchCode,
      tenantId,
      branchId,
      userId,
    } = validated;

    // Extract QR code
    const qrCode = extractQRCode(code);
    if (!qrCode) {
      return NextResponse.json(
        { error: 'Invalid QR code format. Expected format: INMED-000001 to INMED-253973' },
        { status: 400 }
      );
    }

    // Find drug by QR code
    const drug = await prisma.drugLibrary.findUnique({
      where: { qrCode },
      select: {
        id: true,
        brandName: true,
        manufacturer: true,
        qrCode: true,
        isDiscontinued: true,
        category: true,
        packSize: true,
        priceInr: true,
        gstPercent: true,
        dpcoCeilingPriceInr: true,
      },
    });

    if (!drug) {
      return NextResponse.json(
        { error: 'Drug not found for QR code: ' + qrCode },
        { status: 404 }
      );
    }

    if (drug.isDiscontinued) {
      return NextResponse.json(
        { error: 'This drug is discontinued and cannot be added to inventory' },
        { status: 400 }
      );
    }

    // Check if inventory item already exists
    // Note: Using select to avoid errors if mrp column doesn't exist yet
    const existingItem = await prisma.inventoryItem.findFirst({
      where: {
        tenantId,
        branchId: branchId || null,
        drugLibraryId: drug.id,
        batchCode: batchCode || null,
      },
      select: {
        id: true,
        qtyOnHand: true,
        reorderLevel: true,
        purchasePrice: true,
        sellingPrice: true,
        expiryDate: true,
        batchCode: true,
        // mrp may not exist yet - handle gracefully
      },
    });

    // Calculate MRP from drug data
    const calculatedMrp = calculateMrp(drug, sellingPrice ?? null, purchasePrice ?? null);

    let inventoryItem;
    let action = 'CREATE';
    let beforeJson = null;
    let afterJson = null;

    if (existingItem) {
      // Update existing item
      action = 'UPDATE';
      // Get existing mrp safely (may not exist in DB yet)
      const existingMrp = (existingItem as any).mrp ?? null;
      
      beforeJson = JSON.stringify({
        qtyOnHand: existingItem.qtyOnHand,
        reorderLevel: existingItem.reorderLevel,
        purchasePrice: existingItem.purchasePrice,
        sellingPrice: existingItem.sellingPrice,
        mrp: existingMrp,
      });

      // Use calculated MRP or keep existing
      const finalMrp = calculatedMrp ?? existingMrp ?? null;

      // Build update data - only include mrp if it's not null (column may not exist yet)
      const updateData: any = {
        qtyOnHand: existingItem.qtyOnHand + qtyOnHand,
        reorderLevel: reorderLevel ?? existingItem.reorderLevel,
        expiryDate: expiryDate ? new Date(expiryDate) : existingItem.expiryDate,
        purchasePrice: purchasePrice ?? existingItem.purchasePrice,
        sellingPrice: sellingPrice ?? existingItem.sellingPrice,
        batchCode: batchCode ?? existingItem.batchCode,
        updatedAt: new Date(),
      };
      
      // Only set mrp if we have a value
      if (finalMrp != null) {
        updateData.mrp = finalMrp;
      }

      inventoryItem = await prisma.inventoryItem.update({
        where: { id: existingItem.id },
        data: updateData,
        include: {
          drugLibrary: {
            select: {
              id: true,
              brandName: true,
              manufacturer: true,
              qrCode: true,
              category: true,
              packSize: true,
              priceInr: true,
              gstPercent: true,
              dpcoCeilingPriceInr: true,
            },
          },
        },
      });

      afterJson = JSON.stringify({
        qtyOnHand: inventoryItem.qtyOnHand,
        reorderLevel: inventoryItem.reorderLevel,
        purchasePrice: inventoryItem.purchasePrice,
        sellingPrice: inventoryItem.sellingPrice,
        mrp: inventoryItem.mrp,
      });
    } else {
      // Create new inventory item
      // Build create data - only include mrp if it's not null (column may not exist yet)
      const createData: any = {
        tenantId,
        branchId: branchId || null,
        drugLibraryId: drug.id,
        qtyOnHand,
        reorderLevel: reorderLevel ?? 0,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        purchasePrice: purchasePrice ?? null,
        sellingPrice: sellingPrice ?? null,
        batchCode: batchCode ?? null,
      };
      
      // Only set mrp if we have a value
      if (calculatedMrp != null) {
        createData.mrp = calculatedMrp;
      }

      inventoryItem = await prisma.inventoryItem.create({
        data: createData,
        include: {
          drugLibrary: {
            select: {
              id: true,
              brandName: true,
              manufacturer: true,
              qrCode: true,
              category: true,
              packSize: true,
              priceInr: true,
              gstPercent: true,
              dpcoCeilingPriceInr: true,
            },
          },
        },
      });

      afterJson = JSON.stringify({
        qtyOnHand: inventoryItem.qtyOnHand,
        reorderLevel: inventoryItem.reorderLevel,
        purchasePrice: inventoryItem.purchasePrice,
        sellingPrice: inventoryItem.sellingPrice,
        mrp: inventoryItem.mrp,
      });
    }

    // Update scan memory
    try {
      await prisma.drugScanMemory.updateMany({
        where: {
          tenantId,
          branchId: branchId || null,
          qrCode,
        },
        data: {
          lastAddedToInventoryAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to update scan memory:', error);
    }

    // Create audit log entry
    try {
      await prisma.auditLog.create({
        data: {
          tenantId,
          branchId: branchId || null,
          userId: userId || null,
          action,
          entity: 'INVENTORY_ITEM',
          entityId: inventoryItem.id,
          beforeJson,
          afterJson,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: existingItem ? 'Inventory quantity updated' : 'Drug added to inventory successfully',
      inventoryItem: {
        id: inventoryItem.id,
        drugLibraryId: inventoryItem.drugLibraryId,
        brandName: inventoryItem.drugLibrary.brandName,
        manufacturer: inventoryItem.drugLibrary.manufacturer,
        qrCode: inventoryItem.drugLibrary.qrCode,
        qtyOnHand: inventoryItem.qtyOnHand,
        reorderLevel: inventoryItem.reorderLevel,
        expiryDate: inventoryItem.expiryDate,
        purchasePrice: inventoryItem.purchasePrice,
        sellingPrice: inventoryItem.sellingPrice,
        batchCode: inventoryItem.batchCode,
        category: inventoryItem.drugLibrary.category,
        packSize: inventoryItem.drugLibrary.packSize,
        priceInr: inventoryItem.drugLibrary.priceInr,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'This drug already exists in inventory with the same batch code' },
          { status: 409 }
        );
      }
    }

    // Handle schema mismatch errors (e.g., missing mrp column)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('does not exist') || errorMessage.includes('column')) {
      console.error('❌ [Add to Inventory from QR] Schema mismatch error:', errorMessage);
      const isDev = process.env.NODE_ENV === 'development';
      return NextResponse.json(
        { 
          error: isDev
            ? `Inventory schema mismatch. Column may be missing. Error: ${errorMessage}. Please run migration: add_mrp_to_inventory_items.sql`
            : 'Failed to add item. Inventory schema mismatch. Please contact admin.'
        },
        { status: 500 }
      );
    }

    console.error('❌ [Add to Inventory from QR] Error:', error);
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      { 
        error: isDev
          ? (error as Error).message 
          : 'Failed to add drug to inventory. Please try again.'
      },
      { status: 500 }
    );
  }
}

