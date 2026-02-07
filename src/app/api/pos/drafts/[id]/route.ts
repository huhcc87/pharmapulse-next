import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const d = await prisma.saleDraft.findUnique({
    where: { id: resolvedParams.id },
    include: { items: true },
  });
  if (!d) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(d);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  await prisma.saleDraft.delete({ where: { id: resolvedParams.id } });
  return NextResponse.json({ ok: true });
}
