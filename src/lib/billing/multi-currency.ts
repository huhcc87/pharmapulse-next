// src/lib/billing/multi-currency.ts
// Multi-Currency Support
// Currency selection, exchange rate management, multi-currency invoices

import { prisma } from "@/lib/prisma";

export interface CurrencyData {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
}

export interface ExchangeRateData {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate: Date;
  source?: string;
}

/**
 * Get available currencies
 */
export async function getCurrencies(): Promise<CurrencyData[]> {
  const currencies = await prisma.currency.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });

  return currencies.map((c) => ({
    code: c.code,
    name: c.name,
    symbol: c.symbol,
    decimalPlaces: c.decimalPlaces,
  }));
}

/**
 * Set tenant default currency
 */
export async function setTenantCurrency(
  tenantId: string,
  currencyCode: string,
  isDefault: boolean = true
): Promise<void> {
  try {
    const currency = await prisma.currency.findUnique({
      where: { code: currencyCode },
    });
    if (!currency) throw new Error("Currency not found");

    if (isDefault) {
      await prisma.tenantCurrency.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    await prisma.tenantCurrency.upsert({
      where: {
        tenantId_currencyCode: {
          tenantId,
          currencyCode,
        },
      },
      create: {
        tenantId,
        currencyCode,
        isDefault,
      },
      update: {
        isDefault,
      },
    });
  } catch (error: any) {
    console.error("Set tenant currency error:", error);
    throw error;
  }
}

/**
 * Get tenant currencies
 *
 * NOTE:
 * Your Prisma schema does not define a relation between TenantCurrency and Currency,
 * so we do NOT use `include`. We join manually using a currencyMap.
 */
export async function getTenantCurrencies(
  tenantId: string
): Promise<
  Array<{
    currencyCode: string;
    isDefault: boolean;
    currency?: CurrencyData;
  }>
> {
  const tenantCurrencies = await prisma.tenantCurrency.findMany({
    where: { tenantId },
    orderBy: [{ isDefault: "desc" }, { currencyCode: "asc" }],
  });

  const currencies = await getCurrencies();
  const currencyMap = new Map(currencies.map((c) => [c.code, c]));

  return tenantCurrencies.map((tc) => ({
    currencyCode: tc.currencyCode,
    isDefault: tc.isDefault,
    currency: currencyMap.get(tc.currencyCode),
  }));
}

/**
 * Get exchange rate
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  date?: Date
): Promise<number> {
  try {
    if (fromCurrency === toCurrency) return 1;

    const effectiveDate = date || new Date();

    const exchangeRate = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency,
        toCurrency,
        effectiveDate: { lte: effectiveDate },
      },
      orderBy: { effectiveDate: "desc" },
    });

    if (!exchangeRate) return 1;

    return Number(exchangeRate.rate);
  } catch (error: any) {
    console.error("Get exchange rate error:", error);
    throw error;
  }
}

/**
 * Set exchange rate
 */
export async function setExchangeRate(data: ExchangeRateData): Promise<void> {
  try {
    await prisma.exchangeRate.create({
      data: {
        fromCurrency: data.fromCurrency,
        toCurrency: data.toCurrency,
        rate: data.rate,
        effectiveDate: data.effectiveDate,
        source: data.source || "MANUAL",
      },
    });
  } catch (error: any) {
    console.error("Set exchange rate error:", error);
    throw error;
  }
}

/**
 * Convert amount between currencies
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  date?: Date
): Promise<number> {
  try {
    const rate = await getExchangeRate(fromCurrency, toCurrency, date);
    return amount * rate;
  } catch (error: any) {
    console.error("Convert currency error:", error);
    throw error;
  }
}
