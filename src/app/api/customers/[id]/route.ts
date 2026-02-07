// src/app/api/customers/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id: Number(id) },
      include: {
        loyaltyAccount: {
          include: {
            transactions: {
              orderBy: { createdAt: "desc" },
              take: 10,
            },
          },
        },
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            lineItems: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({
      customer: {
        ...customer,
        loyaltyPoints: customer.loyaltyAccount?.pointsBalance || 0,
        allergies: customer.allergies ? JSON.parse(customer.allergies) : [],
      },
      purchaseHistory: customer.invoices,
      loyaltyHistory: customer.loyaltyAccount?.transactions || [],
    });
  } catch (error: any) {
    console.error("Customer fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch customer" },
      { status: 500 }
    );
  }
}

