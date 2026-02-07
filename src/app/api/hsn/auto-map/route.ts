import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { batchAutoMapHsn } from "@/lib/hsn/auto-map";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { items } = body;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: "Items array required" }, { status: 400 });
    }

    const suggestions = await batchAutoMapHsn(items);

    const results = items.map((item: any) => {
      const key = item.productId || item.drugLibraryId || 0;
      return {
        ...item,
        suggestion: suggestions.get(key) || null,
      };
    });

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("HSN auto-map error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to auto-map HSN" },
      { status: 500 }
    );
  }
}
