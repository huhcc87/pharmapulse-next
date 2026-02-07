import { NextResponse } from "next/server";
import { getAllRecords, createRecord } from "@/lib/adherence-storage";

// GET - Fetch all adherence records
export async function GET() {
  try {
    const records = getAllRecords();
    return NextResponse.json(records);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create new adherence record
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, phone, medication, adherenceRate, status, lastDose, nextDose, missedDoses } = body;

    if (!name || !medication) {
      return NextResponse.json({ error: "Name and medication are required" }, { status: 400 });
    }

    const newRecord = createRecord({
      name: name.trim(),
      phone: phone?.trim() || '',
      medication: medication.trim(),
      adherenceRate: Number(adherenceRate) || 0,
      status: (status || 'moderate') as 'good' | 'moderate' | 'poor',
      lastDose: lastDose || '',
      nextDose: nextDose || '',
      missedDoses: Number(missedDoses) || 0,
    });

    return NextResponse.json(newRecord, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

