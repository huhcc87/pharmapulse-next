import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/inventory/items - Get all inventory items with drug library details
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId') ? parseInt(searchParams.get('tenantId')!) : 1;
    const branchId = searchParams.get('branchId') ? parseInt(searchParams.get('branchId')!) : 1;
    const search = searchParams.get('search');

    // Fetch inventory items with drug library details
    // Using explicit select to avoid errors if mrp column doesn't exist yet
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: {
        tenantId,
        branchId: branchId || null,
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
            category: true,
            packSize: true,
            priceInr: true,
            dpcoCeilingPriceInr: true,
            qrCode: true,
            fullComposition: true,
            salts: true,
            schedule: true,
          },
        },
        // mrp field handled safely via type casting below
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Transform to unified format
    const products = inventoryItems.map((item: any) => {
      // Parse price: prioritize sellingPrice, then dpcoCeilingPriceInr, then priceInr string
      let unitPrice = item.sellingPrice || 0;
      // Get mrp safely (may not exist in DB yet)
      let mrp = item.mrp ?? null;
      
      if (!unitPrice || unitPrice === 0) {
        // Try dpcoCeilingPriceInr (numeric)
        if (item.drugLibrary.dpcoCeilingPriceInr && typeof item.drugLibrary.dpcoCeilingPriceInr === 'number') {
          unitPrice = item.drugLibrary.dpcoCeilingPriceInr;
          mrp = item.drugLibrary.dpcoCeilingPriceInr;
        } else if (item.drugLibrary.priceInr) {
          // Parse string price
          const priceStr = String(item.drugLibrary.priceInr).replace(/[^\d.]/g, '');
          const priceNum = parseFloat(priceStr);
          if (!isNaN(priceNum) && priceNum > 0) {
            unitPrice = priceNum;
            mrp = priceNum;
          }
        }
      } else {
        // If sellingPrice exists, use dpcoCeilingPriceInr as MRP
        if (item.drugLibrary.dpcoCeilingPriceInr && typeof item.drugLibrary.dpcoCeilingPriceInr === 'number') {
          mrp = item.drugLibrary.dpcoCeilingPriceInr;
        } else if (item.drugLibrary.priceInr) {
          const priceStr = String(item.drugLibrary.priceInr).replace(/[^\d.]/g, '');
          const priceNum = parseFloat(priceStr);
          if (!isNaN(priceNum) && priceNum > 0) {
            mrp = priceNum;
          }
        }
      }

      return {
        id: item.id,
        name: item.drugLibrary.brandName,
        sku: `DRUG-${item.drugLibrary.id}`,
        barcode: item.drugLibrary.qrCode,
        category: item.drugLibrary.category || 'General',
        manufacturer: item.drugLibrary.manufacturer,
        composition: item.drugLibrary.fullComposition,
        saltComposition: item.drugLibrary.salts,
        hsnCode: null, // Not in drug library
        schedule: item.drugLibrary.schedule,
        description: item.drugLibrary.fullComposition,
        stockLevel: item.qtyOnHand,
        unitPrice: unitPrice,
        mrp: mrp,
        minStock: item.reorderLevel || 0,
        packSize: item.drugLibrary.packSize,
        qrCode: item.drugLibrary.qrCode,
        drugLibraryId: item.drugLibraryId,
        expiryDate: item.expiryDate,
        purchasePrice: item.purchasePrice,
        sellingPrice: item.sellingPrice,
        batchCode: item.batchCode,
      };
    });

    // Apply search filter if provided
    let filteredProducts = products;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.sku.toLowerCase().includes(searchLower) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchLower)) ||
        (p.manufacturer && p.manufacturer.toLowerCase().includes(searchLower)) ||
        (p.composition && p.composition.toLowerCase().includes(searchLower))
      );
    }

    return NextResponse.json(filteredProducts);
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory items' },
      { status: 500 }
    );
  }
}

