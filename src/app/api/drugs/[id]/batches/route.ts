import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { getFefoBatchesForDrug } from "@/lib/inventory/fefo";

const DEMO_TENANT_ID = 1;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const { id } = await params;
    const drugLibraryId = parseInt(id);

    if (isNaN(drugLibraryId)) {
      return NextResponse.json({ error: "Invalid drug ID" }, { status: 400 });
    }

    const batches = await getFefoBatchesForDrug(drugLibraryId, DEMO_TENANT_ID, null);

    return NextResponse.json({ batches });
  } catch (error: any) {
    console.error("Error fetching batches:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch batches" },
      { status: 500 }
    );
  }
}
