import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const jobs = await prisma.printJob.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  return NextResponse.json(jobs);
}

export async function POST(req: Request) {
  const body = await req.json();
  const kind = String(body.kind || "receipt");
  const payload = body.payload ?? {};
  const job = await prisma.printJob.create({ data: { kind, payload, status: "QUEUED" } });
  return NextResponse.json(job);
}
