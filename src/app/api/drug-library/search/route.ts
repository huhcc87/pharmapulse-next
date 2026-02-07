// src/app/api/drug-library/search/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();

    if (!q) return NextResponse.json({ results: [], total: 0, limit: 50 });

    // First, check if database has any drugs
    const totalDrugs = await prisma.drugLibrary.count();
    
    if (totalDrugs === 0) {
      return NextResponse.json({
        results: [],
        total: 0,
        limit: 50,
        error: "Drug library is empty. Please import drug data first.",
        hint: "Run: npm run db:import-drug-library"
      });
    }

    // Check if query is a QR code pattern
    const isQRCode = /^INMED-?\d{1,6}$/i.test(q.trim());
    
    let whereClause: any;
    
    if (isQRCode) {
      // Exact QR code match (case-insensitive)
      const qrCode = q.trim().toUpperCase().replace(/^INMED-?/, 'INMED-');
      whereClause = {
        OR: [
          { qrCode: { equals: qrCode, mode: "insensitive" } },
          { qrCode: qrCode },
        ],
      };
    } else {
      // Regular search - try multiple fields
      const searchConditions: any[] = [
        { brandName: { contains: q, mode: "insensitive" } },
        { salts: { contains: q, mode: "insensitive" } },
        { fullComposition: { contains: q, mode: "insensitive" } },
        { manufacturer: { contains: q, mode: "insensitive" } },
        { qrCode: { contains: q, mode: "insensitive" } },
      ];

      // Add normalized fields if they exist (optional)
      try {
        searchConditions.push(
          { brandNameNorm: { contains: q, mode: "insensitive" } },
          { saltsNorm: { contains: q, mode: "insensitive" } },
          { compositionNorm: { contains: q, mode: "insensitive" } }
        );
      } catch (e) {
        // Fields might not exist, ignore
      }

      whereClause = { OR: searchConditions };
    }

    const results = await prisma.drugLibrary.findMany({
      where: whereClause,
      take: 50, // Increased limit
      select: {
        id: true,
        brandName: true,
        packSize: true,
        gstPercent: true,
        priceInr: true, // String field - will parse
        dpcoCeilingPriceInr: true, // Numeric field
        qrCode: true,
        manufacturer: true,
        salts: true,
        fullComposition: true,
        category: true,
        isDiscontinued: true,
        schedule: true,
        rxOtc: true,
        composition1: true,
        composition2: true,
      },
    });

    // Add total count for better UX
    const total = await prisma.drugLibrary.count({
      where: whereClause,
    });

    return NextResponse.json({ 
      results,
      total,
      limit: 50 
    });
  } catch (error: any) {
    console.error("❌ [Drug Library Search] Error:", error);
    return NextResponse.json(
      {
        results: [],
        total: 0,
        limit: 50,
        error: error.message || "Failed to search drug library",
      },
      { status: 500 }
    );
  }
}
