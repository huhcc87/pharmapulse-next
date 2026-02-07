import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const body = await req.json();
  const status = String(body.status || "").toUpperCase();
  const error = body.error ? String(body.error) : null;

  const job = await prisma.printJob.update({
    where: { id: Number(resolvedParams.id) },
    data: { status, error },
  });
  return NextResponse.json(job);
}
