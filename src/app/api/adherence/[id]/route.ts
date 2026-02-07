import { NextResponse } from "next/server";
import { getRecordById, updateRecord, deleteRecord } from "@/lib/adherence-storage";

// GET - Fetch single adherence record
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const params = await ctx.params;
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid record ID" }, { status: 400 });
    }
    
    const record = getRecordById(id);

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch (error: any) {
    console.error('Error fetching adherence record:', error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// PUT - Update adherence record
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const params = await ctx.params;
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid record ID" }, { status: 400 });
    }
    
    const body = await req.json();
    const { name, phone, medication, adherenceRate, status, lastDose, nextDose, missedDoses } = body;

    if (!name || !medication) {
      return NextResponse.json({ error: "Name and medication are required" }, { status: 400 });
    }

    const updatedRecord = updateRecord(id, {
      name: name.trim(),
      phone: phone?.trim() || '',
      medication: medication.trim(),
      adherenceRate: Number(adherenceRate) || 0,
      status: (status || 'moderate') as 'good' | 'moderate' | 'poor',
      lastDose: lastDose || '',
      nextDose: nextDose || '',
      missedDoses: Number(missedDoses) || 0,
    });

    if (!updatedRecord) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json(updatedRecord);
  } catch (error: any) {
    console.error('Error updating adherence record:', error);
    return NextResponse.json({ error: error.message || "Failed to update record" }, { status: 500 });
  }
}

// DELETE - Delete adherence record
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const params = await ctx.params;
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid record ID" }, { status: 400 });
    }
    
    const success = deleteRecord(id);

    if (!success) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Record deleted" });
  } catch (error: any) {
    console.error('Error deleting adherence record:', error);
    return NextResponse.json({ error: error.message || "Failed to delete record" }, { status: 500 });
  }
}

