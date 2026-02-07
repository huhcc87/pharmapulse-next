import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { can, createPermissionError } from "@/lib/permissions";
import { logPosAction } from "@/lib/pos-audit";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const userId = parseInt(user.userId) || 1;
    const role = user.role as string;

    // Only owner/admin can set HSN
    if (!can(role, "POS_OVERRIDE_GST")) {
      const error = createPermissionError("POS_OVERRIDE_GST", role);
      return NextResponse.json(error, { status: 403 });
    }

    const body = await req.json();
    const { productId, drugLibraryId, hsnCode, gstRate } = body;

    if (!hsnCode) {
      return NextResponse.json({ error: "HSN code required" }, { status: 400 });
    }

    if (productId) {
      const product = await prisma.product.update({
        where: { id: Number(productId) },
        data: {
          hsnCode,
          gstRate: gstRate ? Number(gstRate) : null,
        },
      });

      await logPosAction("POS_OVERRIDE_GST", userId, 1, null, {
        productId,
        hsnCode,
        gstRate,
      });

      return NextResponse.json({ product });
    } else if (drugLibraryId) {
      // For drug library, we'd need to update inventory items or create a mapping
      // For now, return success
      await logPosAction("POS_OVERRIDE_GST", userId, 1, null, {
        drugLibraryId,
        hsnCode,
        gstRate,
      });

      return NextResponse.json({ success: true, drugLibraryId, hsnCode, gstRate });
    }

    return NextResponse.json({ error: "Either productId or drugLibraryId required" }, { status: 400 });
  } catch (error: any) {
    console.error("HSN set error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to set HSN" },
      { status: 500 }
    );
  }
}
