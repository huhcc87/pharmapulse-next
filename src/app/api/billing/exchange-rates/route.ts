// Exchange Rate Management API
// GET /api/billing/exchange-rates - Get exchange rate
// POST /api/billing/exchange-rates - Set exchange rate

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { getExchangeRate, setExchangeRate, convertCurrency } from "@/lib/billing/multi-currency";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.nextUrl.searchParams;
    const fromCurrency = searchParams.get("from");
    const toCurrency = searchParams.get("to");
    const amount = searchParams.get("amount");
    const date = searchParams.get("date");

    if (!fromCurrency || !toCurrency) {
      return NextResponse.json(
        { error: "fromCurrency and toCurrency are required" },
        { status: 400 }
      );
    }

    if (amount) {
      // Convert currency
      const converted = await convertCurrency(
        parseFloat(amount),
        fromCurrency,
        toCurrency,
        date ? new Date(date) : undefined
      );
      return NextResponse.json({
        fromCurrency,
        toCurrency,
        originalAmount: parseFloat(amount),
        convertedAmount: converted,
        rate: await getExchangeRate(fromCurrency, toCurrency, date ? new Date(date) : undefined),
      });
    } else {
      // Get exchange rate
      const rate = await getExchangeRate(
        fromCurrency,
        toCurrency,
        date ? new Date(date) : undefined
      );
      return NextResponse.json({
        fromCurrency,
        toCurrency,
        rate,
      });
    }
  } catch (error: any) {
    console.error("Get exchange rate API error:", error);
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
    const { fromCurrency, toCurrency, rate, effectiveDate, source } = body;

    if (!fromCurrency || !toCurrency || !rate) {
      return NextResponse.json(
        { error: "fromCurrency, toCurrency, and rate are required" },
        { status: 400 }
      );
    }

    await setExchangeRate({
      fromCurrency,
      toCurrency,
      rate: parseFloat(rate),
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      source,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("Set exchange rate API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
