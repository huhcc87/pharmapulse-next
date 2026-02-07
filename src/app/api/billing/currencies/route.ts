// Multi-Currency Support API
// GET /api/billing/currencies - List currencies
// POST /api/billing/currencies - Set tenant currency

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { getCurrencies, setTenantCurrency, getTenantCurrencies } from "@/lib/billing/multi-currency";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type"); // all, tenant

    if (type === "tenant") {
      const tenantCurrencies = await getTenantCurrencies(tenantId);
      return NextResponse.json({ currencies: tenantCurrencies });
    } else {
      const currencies = await getCurrencies();
      return NextResponse.json({ currencies });
    }
  } catch (error: any) {
    console.error("Get currencies API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { currencyCode, isDefault } = body;

    if (!currencyCode) {
      return NextResponse.json(
        { error: "currencyCode is required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";

    await setTenantCurrency(tenantId, currencyCode, isDefault !== false);

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("Set tenant currency API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
