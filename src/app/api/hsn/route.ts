// src/app/api/hsn/route.ts
// HSN Master API - GET (list) and POST (create)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/hsn - List HSN codes
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const search = searchParams.get("search")?.trim() || "";

    const where: any = {};
    if (!includeInactive) {
      where.isActive = true;
    }
    if (search) {
      where.OR = [
        { hsnCode: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
      ];
    }

    const hsnList = await prisma.hSNMaster.findMany({
      where,
      orderBy: { hsnCode: "asc" },
    });

    return NextResponse.json({
      ok: true,
      hsn: hsnList.map((h) => ({
        id: h.id,
        hsnCode: h.hsnCode,
        description: h.description,
        gstRate: h.defaultGstRate != null ? Number(h.defaultGstRate) : null,
        gstType: h.gstType,
        category: h.category,
        isActive: h.isActive,
        createdAt: h.createdAt.toISOString(),
        updatedAt: h.updatedAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error("HSN list error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to list HSN codes" },
      { status: 500 }
    );
  }
}

// POST /api/hsn - Create HSN code
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { hsnCode, description, gstRate, gstType, category } = body;

    // Validation
    if (!hsnCode || !description) {
      return NextResponse.json(
        { ok: false, error: "HSN code and description are required" },
        { status: 400 }
      );
    }

    // Validate HSN format
    if (!/^\d{4,8}$/.test(hsnCode.trim())) {
      return NextResponse.json(
        { ok: false, error: "HSN code must be 4-8 digits" },
        { status: 400 }
      );
    }

    // Validate GST rate
    const allowedRates = [0, 5, 12, 18, 28];
    const rateNum = Number(gstRate);
    if (!allowedRates.includes(rateNum)) {
      return NextResponse.json(
        { ok: false, error: "GST rate must be one of: 0, 5, 12, 18, 28" },
        { status: 400 }
      );
    }

    // Validate GST type
    if (!gstType || !["INCLUSIVE", "EXCLUSIVE"].includes(gstType)) {
      return NextResponse.json(
        { ok: false, error: "GST type must be INCLUSIVE or EXCLUSIVE" },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await prisma.hSNMaster.findUnique({
      where: { hsnCode: hsnCode.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: `HSN code ${hsnCode} already exists` },
        { status: 409 }
      );
    }

    const created = await prisma.hSNMaster.create({
      data: {
        hsnCode: hsnCode.trim(),
        description: description.trim(),
        defaultGstRate: rateNum,
        gstType: gstType,
        category: category?.trim() || null,
        isActive: true,
      },
    });

    return NextResponse.json({
      ok: true,
      hsn: {
        id: created.id,
        hsnCode: created.hsnCode,
        description: created.description,
        gstRate: created.defaultGstRate != null ? Number(created.defaultGstRate) : null,
        gstType: created.gstType,
        category: created.category,
        isActive: created.isActive,
      },
    });
  } catch (error: any) {
    console.error("HSN create error:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "HSN code already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to create HSN code" },
      { status: 500 }
    );
  }
}


