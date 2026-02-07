// AI-powered HSN suggestions (advisory only, never auto-saves)

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface HsnSuggestion {
  hsnCode: string;
  description: string;
  gstRate: number;
  gstType: "EXCLUSIVE" | "INCLUSIVE";
  confidence: number;
  rationale: string;
  source: "AI";
}

/**
 * Get AI suggestions for HSN code based on product details
 * Only called when deterministic rules fail or confidence is low
 */
export async function suggestHsnAI(
  productName: string,
  category?: string,
  saltComposition?: string,
  brandName?: string
): Promise<HsnSuggestion[]> {
  if (!process.env.OPENAI_API_KEY) {
    return []; // Fallback: no AI suggestions without API key
  }

  try {
    const prompt = `You are a tax expert for Indian pharmaceutical products. Suggest HSN codes for this product:

Product Name: ${productName}
${category ? `Category: ${category}` : ""}
${saltComposition ? `Composition: ${saltComposition}` : ""}
${brandName ? `Brand: ${brandName}` : ""}

Return top 3 HSN code suggestions in JSON format:
{
  "suggestions": [
    {
      "hsnCode": "3004",
      "description": "Medicaments (medicines) consisting of mixed or unmixed products for therapeutic or prophylactic uses",
      "gstRate": 12,
      "gstType": "EXCLUSIVE",
      "confidence": 0.9,
      "rationale": "This is a standard medicine, falls under HSN 3004"
    }
  ]
}

Common HSN codes for pharmaceuticals:
- 3004: Medicaments (medicines) - 12% GST
- 3003: Medicaments for human use - 12% GST
- 3002: Human blood and animal blood - 12% GST
- 3001: Glands, extracts - 18% GST

Always use Indian GST rules. Be precise with HSN codes (4-8 digits).`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use cheaper model
      messages: [
        {
          role: "system",
          content: "You are a tax expert for Indian pharmaceuticals. Provide accurate HSN codes based on product composition and category. Always cite your rationale.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more deterministic output
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    const suggestions = result.suggestions || [];

    return suggestions.map((s: any) => ({
      ...s,
      source: "AI" as const,
      confidence: s.confidence || 0.7,
      gstType: s.gstType || "EXCLUSIVE",
    }));
  } catch (error) {
    console.error("AI HSN suggestion error:", error);
    return []; // Fail gracefully
  }
}
