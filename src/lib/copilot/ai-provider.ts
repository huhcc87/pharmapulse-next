// AI provider for drug interactions and counseling
// Uses OpenAI API with deterministic fallback

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AIInteractionSuggestion {
  drug1: string;
  drug2: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  mechanism?: string;
  recommendation: string;
  confidence: number;
  source: "AI";
}

export interface AICounselingPoint {
  drug: string;
  points: string[];
  source: "AI";
  confidence: number;
}

/**
 * AI-powered drug interaction checking
 * Only called when deterministic rules don't find matches
 */
export async function checkInteractionsAI(
  drugNames: string[],
  patientAge?: number,
  allergies?: string[]
): Promise<AIInteractionSuggestion[]> {
  if (!process.env.OPENAI_API_KEY) {
    // Fallback: return empty if no API key
    return [];
  }

  try {
    const prompt = `You are a pharmacist AI assistant. Check for potential drug interactions between these medications: ${drugNames.join(", ")}.
${patientAge ? `Patient age: ${patientAge} years.` : ""}
${allergies && allergies.length > 0 ? `Known allergies: ${allergies.join(", ")}.` : ""}

Return a JSON array of interactions with:
- drug1, drug2 (names)
- severity: HIGH, MEDIUM, or LOW
- description (brief, clear)
- mechanism (why they interact)
- recommendation (actionable advice)
- confidence (0-1)

Only return significant interactions. If no significant interactions, return empty array.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use cheaper model for cost efficiency
      messages: [
        {
          role: "system",
          content: "You are a pharmacist AI assistant. Provide accurate, evidence-based drug interaction information. Always cite severity and provide clear recommendations.",
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
    const interactions = result.interactions || [];

    return interactions.map((i: any) => ({
      ...i,
      source: "AI" as const,
      confidence: i.confidence || 0.7,
    }));
  } catch (error) {
    console.error("AI interaction check error:", error);
    return []; // Fail gracefully
  }
}

/**
 * AI-powered counseling points generation
 */
export async function generateCounselingPointsAI(
  drugName: string,
  dosage?: string,
  frequency?: string
): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) {
    return []; // Fallback
  }

  try {
    const prompt = `Generate 3-5 concise, actionable patient counseling points for: ${drugName}
${dosage ? `Dosage: ${dosage}` : ""}
${frequency ? `Frequency: ${frequency}` : ""}

Focus on:
- Timing (morning/evening, with/without food)
- Common side effects
- Storage instructions
- Important warnings
- When to contact doctor

Return as JSON array of strings. Keep each point under 100 characters.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a pharmacist providing patient counseling. Be concise, clear, and practical. Use simple language.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result.points || [];
  } catch (error) {
    console.error("AI counseling generation error:", error);
    return [];
  }
}
