import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getHsnFromDrugLibrary } from "@/lib/gst/hsnLookup";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const drugId = parseInt(params.id);

    if (isNaN(drugId)) {
      return NextResponse.json({ error: "Invalid drug ID" }, { status: 400 });
    }

    const suggestion = await getHsnFromDrugLibrary(drugId, prisma);

    if (!suggestion) {
      return NextResponse.json(
        { error: "Drug not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(suggestion);
  } catch (error: any) {
    console.error("Error fetching HSN:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch HSN" },
      { status: 500 }
    );
  }
}










