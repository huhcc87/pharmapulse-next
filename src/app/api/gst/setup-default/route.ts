import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/gst/setup-default - Create default org and GSTIN for testing
export async function POST() {
  try {
    // Check if org already exists
    let org = await prisma.org.findFirst({
      where: { tenantId: 1 },
    });

    if (!org) {
      org = await prisma.org.create({
        data: {
          tenantId: 1,
          name: "Demo Pharmacy",
          role: "RETAILER",
        },
      });
    }

    // Check if GSTIN already exists
    let gstin = await prisma.orgGstin.findFirst({
      where: { orgId: org.id, isActive: true },
    });

    if (!gstin) {
      gstin = await prisma.orgGstin.create({
        data: {
          orgId: org.id,
          gstin: "27AAAAA0000A1Z5", // Demo GSTIN format
          stateCode: "27", // Maharashtra
          legalName: "Demo Pharmacy",
          isActive: true,
          invoicePrefix: "INV",
          nextInvoiceNo: 1,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Default GSTIN configured",
      gstin: {
        id: gstin.id,
        gstin: gstin.gstin,
        stateCode: gstin.stateCode,
      },
    });
  } catch (error: any) {
    console.error("Setup default GSTIN error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to setup default GSTIN" },
      { status: 500 }
    );
  }
}

