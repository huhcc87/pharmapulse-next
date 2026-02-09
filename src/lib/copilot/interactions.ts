// src/lib/copilot/interactions.ts
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

function normalizeAISuggestion(ai: AIInteractionSuggestion): InteractionResult {
  return {
    drug1: ai.drug1,
    drug2: ai.drug2,
    severity: ai.severity,
    description: ai.description,
    mechanism: ai.mechanism ?? "", // ✅ ensure string (or change to undefined if you prefer)
    recommendation: ai.recommendation,
    source: "AI",
    confidence: ai.confidence ?? 0.7,
  };
}

function samePair(a: { drug1: string; drug2: string }, b: { drug1: string; drug2: string }) {
  return (
    (a.drug1 === b.drug1 && a.drug2 === b.drug2) ||
    (a.drug1 === b.drug2 && a.drug2 === b.drug1)
  );
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
  const ruleInteractions: InteractionResult[] = checkInteractionsRules(drugNames);

  // If rules found high/medium severity and AI is not requested, return early
  const hasHighMedium = ruleInteractions.some(
    (i) => i.severity === "HIGH" || i.severity === "MEDIUM"
  );

  if (hasHighMedium && !options?.useAI) {
    return ruleInteractions;
  }

  // Optionally check with AI for additional insights
  if (options?.useAI && process.env.OPENAI_API_KEY) {
    try {
      const aiSuggestions = await checkInteractionsAI(
        drugNames,
        options.patientAge,
        options.allergies
      );

      // ✅ Ensure combined is InteractionResult[] (not inferred narrower type)
      const combined: InteractionResult[] = [...ruleInteractions];

      for (const ai of aiSuggestions) {
        const exists = ruleInteractions.some((r) => samePair(r, ai));
        if (!exists) {
          combined.push(normalizeAISuggestion(ai));
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
