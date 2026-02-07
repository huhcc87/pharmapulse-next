// Internationalization (i18n) Support
// Multi-language support for Indian market

export type SupportedLanguage = "en" | "hi" | "ta" | "te" | "mr" | "bn" | "gu" | "kn";

export interface Translation {
  [key: string]: string | Translation;
}

// Language metadata
export const languages: Record<SupportedLanguage, { name: string; nativeName: string; flag: string }> = {
  en: { name: "English", nativeName: "English", flag: "🇬🇧" },
  hi: { name: "Hindi", nativeName: "हिंदी", flag: "🇮🇳" },
  ta: { name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳" },
  te: { name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳" },
  mr: { name: "Marathi", nativeName: "मराठी", flag: "🇮🇳" },
  bn: { name: "Bengali", nativeName: "বাংলা", flag: "🇮🇳" },
  gu: { name: "Gujarati", nativeName: "ગુજરાતી", flag: "🇮🇳" },
  kn: { name: "Kannada", nativeName: "ಕನ್ನಡ", flag: "🇮🇳" },
};

// Default language
export const defaultLanguage: SupportedLanguage = "en";

// Load translations (client-side)
let translations: Record<SupportedLanguage, Translation> = {} as any;

export async function loadTranslations(lang: SupportedLanguage): Promise<Translation> {
  try {
    if (translations[lang]) {
      return translations[lang];
    }

    // Dynamic import based on language
    const translationModule = await import(`@/locales/${lang}.json`);
    translations[lang] = translationModule.default || translationModule;
    return translations[lang];
  } catch (error) {
    console.warn(`Failed to load translations for ${lang}, falling back to English`);
    if (lang !== "en") {
      return loadTranslations("en");
    }
    return {};
  }
}

/**
 * Get translation for a key
 */
export function t(key: string, lang: SupportedLanguage = "en", params?: Record<string, string>): string {
  const translation = translations[lang] || translations[defaultLanguage] || {};
  const keys = key.split(".");
  let value: any = translation;

  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k];
    } else {
      // Fallback to English
      if (lang !== "en") {
        return t(key, "en", params);
      }
      return key; // Return key if translation not found
    }
  }

  if (typeof value !== "string") {
    return key;
  }

  // Replace parameters
  if (params) {
    return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
      return params[paramKey] || match;
    });
  }

  return value;
}

/**
 * Get language from request headers or cookie
 */
export function getLanguageFromRequest(headers: Headers): SupportedLanguage {
  // Check Accept-Language header
  const acceptLanguage = headers.get("accept-language");
  if (acceptLanguage) {
    const langs = acceptLanguage.split(",").map((l) => l.split(";")[0].trim().toLowerCase());
    for (const lang of langs) {
      if (lang.startsWith("hi")) return "hi";
      if (lang.startsWith("ta")) return "ta";
      if (lang.startsWith("te")) return "te";
      if (lang.startsWith("mr")) return "mr";
      if (lang.startsWith("bn")) return "bn";
      if (lang.startsWith("gu")) return "gu";
      if (lang.startsWith("kn")) return "kn";
    }
  }

  return defaultLanguage;
}

/**
 * Format invoice in selected language
 */
export async function formatInvoiceInLanguage(
  invoice: any,
  lang: SupportedLanguage
): Promise<string> {
  const trans = await loadTranslations(lang);

  let invoiceText = `${t("invoice.title", lang)}\n\n`;
  invoiceText += `${t("invoice.invoiceNumber", lang)}: ${invoice.invoiceNumber}\n`;
  invoiceText += `${t("invoice.date", lang)}: ${new Date(invoice.invoiceDate).toLocaleDateString()}\n\n`;

  if (invoice.customer) {
    invoiceText += `${t("invoice.customer", lang)}: ${invoice.customer.name}\n`;
  }

  invoiceText += `\n${t("invoice.items", lang)}:\n`;
  invoice.lineItems?.forEach((item: any, idx: number) => {
    invoiceText += `${idx + 1}. ${item.productName} x${item.quantity} - ₹${(item.lineTotalPaise / 100).toFixed(2)}\n`;
  });

  invoiceText += `\n${t("invoice.total", lang)}: ₹${(invoice.totalInvoicePaise / 100).toFixed(2)}\n`;
  invoiceText += `\n${t("invoice.thankYou", lang)}\n`;

  return invoiceText;
}

/**
 * Format WhatsApp message in customer's language
 */
export async function formatWhatsAppMessageInLanguage(
  messageKey: string,
  lang: SupportedLanguage,
  params?: Record<string, string>
): Promise<string> {
  const trans = await loadTranslations(lang);
  return t(messageKey, lang, params);
}
