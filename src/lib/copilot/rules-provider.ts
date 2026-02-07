// Deterministic drug interaction rules provider
// In production, this would load from a database or external API

export interface DrugInteractionRule {
  drug1Pattern: string | RegExp;
  drug2Pattern: string | RegExp;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  mechanism: string;
  recommendation: string;
}

// Common drug interaction rules (deterministic)
const INTERACTION_RULES: DrugInteractionRule[] = [
  // High severity interactions
  {
    drug1Pattern: /paracetamol|acetaminophen/i,
    drug2Pattern: /warfarin|acenocoumarol|coumadin/i,
    severity: "HIGH",
    description: "Increased risk of bleeding due to enhanced anticoagulant effect",
    mechanism: "Paracetamol may enhance the anticoagulant effect of warfarin",
    recommendation: "Monitor INR closely. Consider alternative pain relief.",
  },
  {
    drug1Pattern: /aspirin/i,
    drug2Pattern: /warfarin|acenocoumarol|coumadin/i,
    severity: "HIGH",
    description: "Increased risk of bleeding",
    mechanism: "Aspirin and warfarin both affect blood clotting",
    recommendation: "Avoid concurrent use unless absolutely necessary. Monitor bleeding risk.",
  },
  {
    drug1Pattern: /metformin/i,
    drug2Pattern: /alcohol|ethanol/i,
    severity: "HIGH",
    description: "Risk of lactic acidosis",
    mechanism: "Alcohol may increase risk of lactic acidosis with metformin",
    recommendation: "Avoid alcohol consumption while on metformin.",
  },
  // Medium severity
  {
    drug1Pattern: /omeprazole|pantoprazole|esomeprazole|rabeprazole/i,
    drug2Pattern: /warfarin/i,
    severity: "MEDIUM",
    description: "May increase warfarin levels",
    mechanism: "PPIs may inhibit warfarin metabolism",
    recommendation: "Monitor INR when starting or stopping PPI therapy.",
  },
  {
    drug1Pattern: /amoxicillin|ampicillin/i,
    drug2Pattern: /warfarin/i,
    severity: "MEDIUM",
    description: "May enhance anticoagulant effect",
    mechanism: "Antibiotics may alter gut flora affecting vitamin K",
    recommendation: "Monitor INR during antibiotic therapy.",
  },
  // Low severity / duplicate therapy
  {
    drug1Pattern: /paracetamol|acetaminophen/i,
    drug2Pattern: /paracetamol|acetaminophen/i,
    severity: "LOW",
    description: "Duplicate therapy - same active ingredient",
    mechanism: "Risk of exceeding maximum daily dose (4g/day)",
    recommendation: "Check total daily dose. Maximum 4g/day for adults.",
  },
];

/**
 * Check for drug interactions using deterministic rules
 */
export function checkInteractionsRules(
  drugNames: string[]
): Array<{
  drug1: string;
  drug2: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  mechanism: string;
  recommendation: string;
  source: "RULES";
}> {
  const interactions: any[] = [];

  // Check all pairs
  for (let i = 0; i < drugNames.length; i++) {
    for (let j = i + 1; j < drugNames.length; j++) {
      const drug1 = drugNames[i];
      const drug2 = drugNames[j];

      // Check rules
      for (const rule of INTERACTION_RULES) {
        const match1 = typeof rule.drug1Pattern === "string"
          ? drug1.toLowerCase().includes(rule.drug1Pattern.toLowerCase())
          : rule.drug1Pattern.test(drug1);
        
        const match2 = typeof rule.drug2Pattern === "string"
          ? drug2.toLowerCase().includes(rule.drug2Pattern.toLowerCase())
          : rule.drug2Pattern.test(drug2);

        if (match1 && match2) {
          interactions.push({
            drug1,
            drug2,
            severity: rule.severity,
            description: rule.description,
            mechanism: rule.mechanism,
            recommendation: rule.recommendation,
            source: "RULES",
          });
          break; // Only report first match per pair
        }
      }
    }
  }

  return interactions;
}

/**
 * Check for duplicate therapy (same drug multiple times)
 */
export function checkDuplicateTherapy(drugNames: string[]): Array<{
  drug: string;
  count: number;
  message: string;
}> {
  const counts = new Map<string, number>();
  
  for (const drug of drugNames) {
    const normalized = drug.toLowerCase().trim();
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  const duplicates: any[] = [];
  for (const [drug, count] of counts.entries()) {
    if (count > 1) {
      duplicates.push({
        drug,
        count,
        message: `${drug} appears ${count} times in cart. Check if duplicate therapy is intended.`,
      });
    }
  }

  return duplicates;
}
