// Generate Credit Note from Invoice Return
// POST /api/invoices/[id]/credit-note

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { generateCreditNote } from "@/lib/invoice/credit-note";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const resolvedParams = await params;
    const invoiceId = parseInt(resolvedParams.id);
    const body = await req.json();
    const { returnItems, reason, remarks } = body;

    if (!returnItems || !Array.isArray(returnItems) || returnItems.length === 0) {
      return NextResponse.json(
        { error: "returnItems array is required" },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400 }
      );
    }

    // Generate credit note
    const result = await generateCreditNote({
      invoiceId,
      returnItems,
      reason,
      remarks,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Credit note generation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      creditNote: {
        id: result.creditNoteId,
        creditNoteNumber: result.creditNoteNumber,
        creditAmountPaise: result.creditAmountPaise,
        cgstPaise: result.cgstPaise,
        sgstPaise: result.sgstPaise,
        igstPaise: result.igstPaise,
      },
    });
  } catch (error: any) {
    console.error("Credit note API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
