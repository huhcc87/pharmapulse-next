// Combined drug interaction checking (rules + AI)

import { checkInteractionsRules, checkDuplicateTherapy } from "./rules-provider";
import { checkInteractionsAI, AIInteractionSuggestion } from "./ai-provider";

export interface InteractionResult {
  drug1: string;
  drug2: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  mechanism?: string;
  recommendation: string;
  source: "RULES" | "AI";
  confidence?: number;
}

export interface CounselingResult {
  drug: string;
  points: string[];
  source: "RULES" | "AI";
}

/**
 * Check for drug interactions (rules first, then AI if needed)
 */
export async function checkInteractions(
  drugNames: string[],
  options?: {
    useAI?: boolean;
    patientAge?: number;
    allergies?: string[];
  }
): Promise<InteractionResult[]> {
  // Always check rules first (deterministic)
  const ruleInteractions = checkInteractionsRules(drugNames);

  // If rules found high/medium severity, return early (don't need AI)
  const hasHighMedium = ruleInteractions.some(
    (i) => i.severity === "HIGH" || i.severity === "MEDIUM"
  );

  if (hasHighMedium && !options?.useAI) {
    return ruleInteractions;
  }

  // Optionally check with AI for additional insights
  if (options?.useAI && process.env.OPENAI_API_KEY) {
    try {
      const aiInteractions = await checkInteractionsAI(
        drugNames,
        options.patientAge,
        options.allergies
      );

      // Merge, preferring rules over AI for same drug pairs
      const combined = [...ruleInteractions];
      for (const ai of aiInteractions) {
        // Only add if not already covered by rules
        const exists = ruleInteractions.some(
          (r) =>
            (r.drug1 === ai.drug1 && r.drug2 === ai.drug2) ||
            (r.drug1 === ai.drug2 && r.drug2 === ai.drug1)
        );
        if (!exists) {
          combined.push(ai);
        }
      }

      return combined;
    } catch (error) {
      console.error("AI interaction check failed, using rules only:", error);
      return ruleInteractions;
    }
  }

  return ruleInteractions;
}

/**
 * Get duplicate therapy warnings
 */
export function getDuplicateTherapyWarnings(
  drugNames: string[]
): Array<{ drug: string; count: number; message: string }> {
  return checkDuplicateTherapy(drugNames);
}
