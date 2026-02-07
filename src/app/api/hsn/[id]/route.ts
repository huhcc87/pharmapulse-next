// src/app/api/hsn/[id]/route.ts
// HSN Master API - PATCH (update/disable) and DELETE

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/hsn/[id] - Update HSN code
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { description, gstRate, gstType, category, isActive } = body;

    const updateData: any = {};

    if (description !== undefined) updateData.description = description.trim();
    if (category !== undefined) updateData.category = category?.trim() || null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    if (gstRate !== undefined) {
      const allowedRates = [0, 5, 12, 18, 28];
      const rateNum = Number(gstRate);
      if (!allowedRates.includes(rateNum)) {
        return NextResponse.json(
          { ok: false, error: "GST rate must be one of: 0, 5, 12, 18, 28" },
          { status: 400 }
        );
      }
      updateData.defaultGstRate = rateNum;
    }

    if (gstType !== undefined) {
      if (!["INCLUSIVE", "EXCLUSIVE"].includes(gstType)) {
        return NextResponse.json(
          { ok: false, error: "GST type must be INCLUSIVE or EXCLUSIVE" },
          { status: 400 }
        );
      }
      updateData.gstType = gstType;
    }

    const updated = await prisma.hSNMaster.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ok: true,
      hsn: {
        id: updated.id,
        hsnCode: updated.hsnCode,
        description: updated.description,
        gstRate: updated.defaultGstRate ? Number(updated.defaultGstRate) : null,
        gstType: updated.gstType,
        category: updated.category,
        isActive: updated.isActive,
      },
    });
  } catch (error: any) {
    console.error("HSN update error:", error);
    if (error.code === "P2025") {
      return NextResponse.json(
        { ok: false, error: "HSN code not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to update HSN code" },
      { status: 500 }
    );
  }
}

// DELETE /api/hsn/[id] - Soft delete (set isActive=false)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const updated = await prisma.hSNMaster.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      ok: true,
      message: "HSN code disabled",
      hsn: {
        id: updated.id,
        hsnCode: updated.hsnCode,
        isActive: updated.isActive,
      },
    });
  } catch (error: any) {
    console.error("HSN delete error:", error);
    if (error.code === "P2025") {
      return NextResponse.json(
        { ok: false, error: "HSN code not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to disable HSN code" },
      { status: 500 }
    );
  }
}


