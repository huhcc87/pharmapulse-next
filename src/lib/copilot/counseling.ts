// Patient counseling points generation

import { generateCounselingPointsAI } from "./ai-provider";

// Deterministic counseling rules (common drugs)
const COUNSELING_RULES: Record<
  string,
  {
    timing: string;
    food: string;
    storage: string;
    sideEffects: string[];
    warnings: string[];
  }
> = {
  metformin: {
    timing: "Take with meals to reduce stomach upset",
    food: "Take with food",
    storage: "Store at room temperature, away from moisture",
    sideEffects: ["Nausea", "Diarrhea", "Stomach upset"],
    warnings: ["Avoid alcohol - risk of lactic acidosis", "Monitor blood sugar regularly"],
  },
  paracetamol: {
    timing: "Can be taken with or without food",
    food: "May take with food if stomach upset",
    storage: "Store at room temperature",
    sideEffects: ["Rare: liver damage with overdose"],
    warnings: [
      "Do not exceed 4g per day (adults)",
      "Avoid if liver disease",
      "Do not take with other paracetamol-containing products",
    ],
  },
  amoxicillin: {
    timing: "Take at evenly spaced intervals",
    food: "May take with or without food",
    storage: "Store in refrigerator (if suspension), keep dry (if tablets)",
    sideEffects: ["Diarrhea", "Nausea", "Skin rash"],
    warnings: [
      "Complete full course even if feeling better",
      "Take with food if stomach upset",
      "Contact doctor if severe diarrhea or rash",
    ],
  },
  omeprazole: {
    timing: "Take before meals, preferably in the morning",
    food: "Take on empty stomach, 30-60 minutes before food",
    storage: "Store at room temperature",
    sideEffects: ["Headache", "Diarrhea", "Stomach pain"],
    warnings: ["Do not crush or chew capsules", "May take 2-3 days to feel full effect"],
  },
};

/**
 * Generate counseling points for a drug
 */
export async function generateCounselingPoints(
  drugName: string,
  dosage?: string,
  frequency?: string,
  options?: { useAI?: boolean }
): Promise<{
  points: string[];
  source: "RULES" | "AI";
}> {
  // Try deterministic rules first
  const normalized = drugName.toLowerCase().trim();
  const rule = Object.keys(COUNSELING_RULES).find((key) =>
    normalized.includes(key)
  );

  if (rule) {
    const counseling = COUNSELING_RULES[rule];
    const points = [
      `Timing: ${counseling.timing}`,
      `Food: ${counseling.food}`,
      `Storage: ${counseling.storage}`,
      ...counseling.sideEffects.map((se) => `Side effect: ${se}`),
      ...counseling.warnings.map((w) => `⚠️ ${w}`),
    ];
    return { points, source: "RULES" };
  }

  // Fallback to AI if no rule found
  if (options?.useAI && process.env.OPENAI_API_KEY) {
    try {
      const aiPoints = await generateCounselingPointsAI(drugName, dosage, frequency);
      if (aiPoints.length > 0) {
        return { points: aiPoints, source: "AI" };
      }
    } catch (error) {
      console.error("AI counseling generation failed:", error);
    }
  }

  // Final fallback: generic points
  return {
    points: [
      "Follow doctor's instructions",
      "Take as directed",
      "Store at room temperature",
      "Contact doctor if side effects occur",
    ],
    source: "RULES",
  };
}
