// AI Drug Interaction Checker (Advanced)
// Enhanced drug interaction checking with patient-specific risk assessment

import { prisma } from "@/lib/prisma";

export interface DrugInteractionCheckRequest {
  drugs: Array<{
    id?: number;
    name: string;
    type?: "PRODUCT" | "DRUG_LIBRARY" | "MOLECULE";
  }>;
  patientInfo?: {
    age?: number;
    gender?: "MALE" | "FEMALE" | "OTHER";
    conditions?: string[];
    allergies?: string[];
    isPregnant?: boolean;
    isLactating?: boolean;
  };
  context?: {
    invoiceId?: number;
    prescriptionId?: number;
  };
}

export interface AdvancedDrugInteraction {
  drug1: string;
  drug2: string;
  severity: "MILD" | "MODERATE" | "SEVERE" | "CONTRAINDICATED";
  severityScore: number; // 0-100
  description: string;
  mechanism?: string;
  overallRiskScore: number; // 0-100 (patient-specific)
  riskFactors: string[];
  alternativeDrugs?: Array<{
    name: string;
    reason: string;
  }>;
  foodInteraction?: {
    hasInteraction: boolean;
    details?: string;
  };
  alcoholInteraction?: {
    hasInteraction: boolean;
    details?: string;
  };
  pregnancyWarning?: {
    hasWarning: boolean;
    details?: string;
  };
  lactationWarning?: {
    hasWarning: boolean;
    details?: string;
  };
  contraindicatedConditions?: string[];
  source: "AI" | "DATABASE" | "CDSCO" | "MANUAL";
  confidenceScore?: number;
}

/**
 * Check for advanced drug interactions with patient-specific risk assessment
 */
export async function checkAdvancedDrugInteractions(
  request: DrugInteractionCheckRequest,
  tenantId: number = 1
): Promise<AdvancedDrugInteraction[]> {
  const { drugs, patientInfo, context } = request;
  const interactions: AdvancedDrugInteraction[] = [];

  // Check all drug pairs
  for (let i = 0; i < drugs.length; i++) {
    for (let j = i + 1; j < drugs.length; j++) {
      const drug1 = drugs[i];
      const drug2 = drugs[j];

      // First, check database for known interactions
      const dbInteraction = await checkDatabaseInteraction(
        drug1.name,
        drug2.name,
        tenantId
      );

      if (dbInteraction) {
        // Enhance with patient-specific risk assessment
        const enhanced = await enhanceWithPatientRisk(
          dbInteraction,
          patientInfo
        );
        interactions.push(enhanced);
        continue;
      }

      // Check AI-based interactions (if enabled)
      if (process.env.OPENAI_API_KEY || process.env.AWS_BEDROCK_REGION) {
        const aiInteraction = await checkAIDrugInteraction(
          drug1,
          drug2,
          patientInfo
        );
        if (aiInteraction) {
          interactions.push(aiInteraction);
        }
      }

      // Check food-drug interactions
      const foodInteraction = await checkFoodDrugInteraction(
        drug1.name,
        drug2.name
      );
      if (foodInteraction) {
        interactions.push(foodInteraction);
      }

      // Check alcohol-drug interactions
      const alcoholInteraction = await checkAlcoholDrugInteraction(
        drug1.name,
        drug2.name
      );
      if (alcoholInteraction) {
        interactions.push(alcoholInteraction);
      }

      // Check pregnancy/lactation warnings
      if (patientInfo?.isPregnant || patientInfo?.isLactating) {
        const pregnancyWarning = await checkPregnancyLactationWarning(
          drug1.name,
          drug2.name,
          patientInfo.isPregnant,
          patientInfo.isLactating
        );
        if (pregnancyWarning) {
          interactions.push(pregnancyWarning);
        }
      }
    }
  }

  // Check disease-drug contraindications
  if (patientInfo?.conditions && patientInfo.conditions.length > 0) {
    for (const condition of patientInfo.conditions) {
      const contraindications = await checkDiseaseDrugContraindications(
        drugs.map((d) => d.name),
        condition
      );
      interactions.push(...contraindications);
    }
  }

  // Save interactions to database
  if (interactions.length > 0) {
    await saveInteractionsToDatabase(interactions, tenantId, context);
  }

  return interactions.sort((a, b) => {
    // Sort by severity: CONTRAINDICATED > SEVERE > MODERATE > MILD
    const severityOrder = {
      CONTRAINDICATED: 4,
      SEVERE: 3,
      MODERATE: 2,
      MILD: 1,
    };
    return (
      severityOrder[b.severity] - severityOrder[a.severity] ||
      b.overallRiskScore - a.overallRiskScore
    );
  });
}

/**
 * Check database for known interactions
 */
async function checkDatabaseInteraction(
  drug1Name: string,
  drug2Name: string,
  tenantId: number
): Promise<AdvancedDrugInteraction | null> {
  // Check existing DrugInteraction table
  const interaction = await prisma.drugInteraction.findFirst({
    where: {
      OR: [
        {
          drug1Name: { equals: drug1Name, mode: "insensitive" },
          drug2Name: { equals: drug2Name, mode: "insensitive" },
        },
        {
          drug1Name: { equals: drug2Name, mode: "insensitive" },
          drug2Name: { equals: drug1Name, mode: "insensitive" },
        },
      ],
    },
  });

  if (!interaction) return null;

  // Map severity
  const severityMap: Record<string, "MILD" | "MODERATE" | "SEVERE" | "CONTRAINDICATED"> = {
    LOW: "MILD",
    MEDIUM: "MODERATE",
    HIGH: "SEVERE",
  };

  return {
    drug1: interaction.drug1Name,
    drug2: interaction.drug2Name,
    severity: severityMap[interaction.severity] || "MODERATE",
    severityScore: interaction.severity === "HIGH" ? 80 : interaction.severity === "MEDIUM" ? 50 : 20,
    description: interaction.description,
    mechanism: interaction.mechanism || undefined,
    overallRiskScore: interaction.severity === "HIGH" ? 80 : interaction.severity === "MEDIUM" ? 50 : 20,
    riskFactors: [],
    source: "DATABASE",
    confidenceScore: 90,
  };
}

/**
 * Enhance interaction with patient-specific risk assessment
 */
async function enhanceWithPatientRisk(
  interaction: AdvancedDrugInteraction,
  patientInfo?: DrugInteractionCheckRequest["patientInfo"]
): Promise<AdvancedDrugInteraction> {
  let riskScore = interaction.severityScore;
  const riskFactors: string[] = [];

  // Age-based risk adjustments
  if (patientInfo?.age) {
    if (patientInfo.age < 12) {
      riskScore += 10; // Children are more sensitive
      riskFactors.push("Pediatric patient - increased sensitivity");
    } else if (patientInfo.age > 65) {
      riskScore += 15; // Elderly are more sensitive
      riskFactors.push("Elderly patient - increased sensitivity");
    }
  }

  // Condition-based risk
  if (patientInfo?.conditions && patientInfo.conditions.length > 0) {
    // Check if conditions increase risk
    const highRiskConditions = [
      "kidney disease",
      "liver disease",
      "heart disease",
      "diabetes",
    ];
    const hasHighRiskCondition = patientInfo.conditions.some((c) =>
      highRiskConditions.some((hrc) => c.toLowerCase().includes(hrc))
    );
    if (hasHighRiskCondition) {
      riskScore += 10;
      riskFactors.push("Underlying medical condition increases risk");
    }
  }

  // Allergy-based risk
  if (patientInfo?.allergies && patientInfo.allergies.length > 0) {
    // Check if any drug might cause allergic reaction
    riskScore += 5;
    riskFactors.push("Patient has known allergies - monitor closely");
  }

  // Cap risk score at 100
  riskScore = Math.min(100, riskScore);

  // Determine overall severity based on risk score
  let severity: "MILD" | "MODERATE" | "SEVERE" | "CONTRAINDICATED" = interaction.severity;
  if (riskScore >= 80) {
    severity = "CONTRAINDICATED";
  } else if (riskScore >= 60) {
    severity = "SEVERE";
  } else if (riskScore >= 40) {
    severity = "MODERATE";
  } else {
    severity = "MILD";
  }

  return {
    ...interaction,
    overallRiskScore: riskScore,
    severity,
    riskFactors,
  };
}

/**
 * Check AI-based drug interactions
 */
async function checkAIDrugInteraction(
  drug1: { name: string; id?: number; type?: string },
  drug2: { name: string; id?: number; type?: string },
  patientInfo?: DrugInteractionCheckRequest["patientInfo"]
): Promise<AdvancedDrugInteraction | null> {
  // Use OpenAI or AWS Bedrock for AI-based interaction checking
  try {
    const prompt = `Analyze potential drug interaction between ${drug1.name} and ${drug2.name}.
${patientInfo?.age ? `Patient age: ${patientInfo.age}` : ""}
${patientInfo?.conditions ? `Medical conditions: ${patientInfo.conditions.join(", ")}` : ""}
${patientInfo?.allergies ? `Allergies: ${patientInfo.allergies.join(", ")}` : ""}

Provide:
1. Severity (MILD, MODERATE, SEVERE, CONTRAINDICATED)
2. Severity score (0-100)
3. Description of interaction
4. Mechanism (if known)
5. Risk factors
6. Alternative medications (if any)
7. Confidence score (0-100)

Return as JSON.`;

    // Use existing AI client (OpenAI or Bedrock)
    const aiResponse = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!aiResponse.ok) return null;

    const data = await aiResponse.json();
    const result = JSON.parse(data.response || "{}");

    return {
      drug1: drug1.name,
      drug2: drug2.name,
      severity: result.severity || "MODERATE",
      severityScore: result.severityScore || 50,
      description: result.description || "Potential drug interaction detected",
      mechanism: result.mechanism,
      overallRiskScore: result.severityScore || 50,
      riskFactors: result.riskFactors || [],
      alternativeDrugs: result.alternativeDrugs,
      source: "AI",
      confidenceScore: result.confidenceScore || 70,
    };
  } catch (error) {
    console.error("AI drug interaction check failed:", error);
    return null;
  }
}

/**
 * Check food-drug interactions
 */
async function checkFoodDrugInteraction(
  drug1Name: string,
  drug2Name: string
): Promise<AdvancedDrugInteraction | null> {
  // Common food-drug interactions (Indian context)
  const foodInteractions: Record<string, string[]> = {
    warfarin: ["leafy greens", "vitamin k"],
    tetracycline: ["dairy", "calcium"],
    levothyroxine: ["soy", "calcium", "iron"],
    statins: ["grapefruit"],
  };

  const drug1Lower = drug1Name.toLowerCase();
  const drug2Lower = drug2Name.toLowerCase();

  for (const [drug, foods] of Object.entries(foodInteractions)) {
    if (drug1Lower.includes(drug) || drug2Lower.includes(drug)) {
      return {
        drug1: drug1Name,
        drug2: drug2Name,
        severity: "MODERATE",
        severityScore: 40,
        description: `Food interaction: ${drug} should not be taken with ${foods.join(", ")}`,
        overallRiskScore: 40,
        riskFactors: [`Food interaction with ${foods.join(", ")}`],
        foodInteraction: {
          hasInteraction: true,
          details: `Avoid taking with ${foods.join(", ")}`,
        },
        source: "DATABASE",
        confidenceScore: 85,
      };
    }
  }

  return null;
}

/**
 * Check alcohol-drug interactions
 */
async function checkAlcoholDrugInteraction(
  drug1Name: string,
  drug2Name: string
): Promise<AdvancedDrugInteraction | null> {
  // Common alcohol-drug interactions
  const alcoholInteractions = [
    "paracetamol",
    "acetaminophen",
    "antibiotic",
    "antihistamine",
    "antidepressant",
    "antipsychotic",
    "sedative",
    "benzodiazepine",
  ];

  const drug1Lower = drug1Name.toLowerCase();
  const drug2Lower = drug2Name.toLowerCase();

  const hasInteraction = alcoholInteractions.some(
    (drug) => drug1Lower.includes(drug) || drug2Lower.includes(drug)
  );

  if (hasInteraction) {
    return {
      drug1: drug1Name,
      drug2: drug2Name,
      severity: "MODERATE",
      severityScore: 50,
      description: "Alcohol interaction: Avoid alcohol while taking these medications",
      overallRiskScore: 50,
      riskFactors: ["Alcohol consumption increases risk of side effects"],
      alcoholInteraction: {
        hasInteraction: true,
        details: "Avoid alcohol consumption while taking these medications",
      },
      source: "DATABASE",
      confidenceScore: 80,
    };
  }

  return null;
}

/**
 * Check pregnancy/lactation warnings
 */
async function checkPregnancyLactationWarning(
  drug1Name: string,
  drug2Name: string,
  isPregnant?: boolean,
  isLactating?: boolean
): Promise<AdvancedDrugInteraction | null> {
  // Drugs contraindicated in pregnancy/lactation
  const pregnancyContraindicated = [
    "warfarin",
    "isotretinoin",
    "thalidomide",
    "ace inhibitor",
    "angiotensin",
  ];

  const drug1Lower = drug1Name.toLowerCase();
  const drug2Lower = drug2Name.toLowerCase();

  const hasWarning = pregnancyContraindicated.some(
    (drug) => drug1Lower.includes(drug) || drug2Lower.includes(drug)
  );

  if (hasWarning) {
    const warnings: string[] = [];
    if (isPregnant) warnings.push("Contraindicated in pregnancy");
    if (isLactating) warnings.push("Contraindicated during lactation");

    return {
      drug1: drug1Name,
      drug2: drug2Name,
      severity: isPregnant ? "CONTRAINDICATED" : "SEVERE",
      severityScore: isPregnant ? 95 : 70,
      description: `${warnings.join(" and ")}: These medications are not safe during pregnancy/lactation`,
      overallRiskScore: isPregnant ? 95 : 70,
      riskFactors: warnings,
      pregnancyWarning: isPregnant
        ? {
            hasWarning: true,
            details: "Contraindicated in pregnancy - do not use",
          }
        : undefined,
      lactationWarning: isLactating
        ? {
            hasWarning: true,
            details: "Contraindicated during lactation - do not use",
          }
        : undefined,
      source: "DATABASE",
      confidenceScore: 90,
    };
  }

  return null;
}

/**
 * Check disease-drug contraindications
 */
async function checkDiseaseDrugContraindications(
  drugNames: string[],
  condition: string
): Promise<AdvancedDrugInteraction[]> {
  const interactions: AdvancedDrugInteraction[] = [];

  // Common contraindications
  const contraindications: Record<string, string[]> = {
    "kidney disease": ["nsaid", "ibuprofen", "naproxen"],
    "liver disease": ["paracetamol", "acetaminophen"],
    "heart disease": ["decongestant", "pseudoephedrine"],
    diabetes: ["corticosteroid", "prednisone"],
  };

  const conditionLower = condition.toLowerCase();
  const contraindicatedDrugs = contraindications[conditionLower] || [];

  for (const drugName of drugNames) {
    const drugLower = drugName.toLowerCase();
    const isContraindicated = contraindicatedDrugs.some((cd) =>
      drugLower.includes(cd)
    );

    if (isContraindicated) {
      interactions.push({
        drug1: drugName,
        drug2: condition,
        severity: "CONTRAINDICATED",
        severityScore: 90,
        description: `${drugName} is contraindicated in patients with ${condition}`,
        overallRiskScore: 90,
        riskFactors: [`Contraindicated in ${condition}`],
        contraindicatedConditions: [condition],
        source: "DATABASE",
        confidenceScore: 85,
      });
    }
  }

  return interactions;
}

/**
 * Save interactions to database
 */
async function saveInteractionsToDatabase(
  interactions: AdvancedDrugInteraction[],
  tenantId: number,
  context?: DrugInteractionCheckRequest["context"]
): Promise<void> {
  try {
    await prisma.$transaction(
      interactions.map((interaction) =>
        prisma.aIDrugInteraction.create({
          data: {
            tenantId,
            drug1Name: interaction.drug1,
            drug2Name: interaction.drug2,
            severity: interaction.severity,
            severityScore: interaction.severityScore,
            description: interaction.description,
            mechanism: interaction.mechanism,
            overallRiskScore: interaction.overallRiskScore,
            riskFactors: interaction.riskFactors,
            alternativeDrugs: interaction.alternativeDrugs,
            foodInteraction: interaction.foodInteraction?.hasInteraction || false,
            foodInteractionDetails: interaction.foodInteraction?.details,
            alcoholInteraction: interaction.alcoholInteraction?.hasInteraction || false,
            alcoholInteractionDetails: interaction.alcoholInteraction?.details,
            pregnancyWarning: interaction.pregnancyWarning?.hasWarning || false,
            pregnancyWarningDetails: interaction.pregnancyWarning?.details,
            lactationWarning: interaction.lactationWarning?.hasWarning || false,
            lactationWarningDetails: interaction.lactationWarning?.details,
            contraindicatedConditions: interaction.contraindicatedConditions,
            source: interaction.source,
            confidenceScore: interaction.confidenceScore,
            invoiceId: context?.invoiceId,
            prescriptionId: context?.prescriptionId,
          },
        })
      )
    );
  } catch (error) {
    console.error("Failed to save interactions to database:", error);
    // Don't throw - logging is sufficient
  }
}

/**
 * Get interaction history for a patient
 */
export async function getInteractionHistory(
  patientId: number,
  tenantId: number = 1,
  limit: number = 50
): Promise<AdvancedDrugInteraction[]> {
  const interactions = await prisma.aIDrugInteraction.findMany({
    where: {
      tenantId,
      // Note: We'd need to link to customer/invoice to filter by patient
      // For now, return recent interactions
    },
    orderBy: {
      checkedAt: "desc",
    },
    take: limit,
  });

  return interactions.map((i) => ({
    drug1: i.drug1Name,
    drug2: i.drug2Name,
    severity: i.severity as any,
    severityScore: Number(i.severityScore),
    description: i.description,
    mechanism: i.mechanism || undefined,
    overallRiskScore: Number(i.overallRiskScore),
    riskFactors: (i.riskFactors as string[]) || [],
    alternativeDrugs: i.alternativeDrugs as any,
    foodInteraction: i.foodInteraction
      ? {
          hasInteraction: i.foodInteraction,
          details: i.foodInteractionDetails || undefined,
        }
      : undefined,
    alcoholInteraction: i.alcoholInteraction
      ? {
          hasInteraction: i.alcoholInteraction,
          details: i.alcoholInteractionDetails || undefined,
        }
      : undefined,
    pregnancyWarning: i.pregnancyWarning
      ? {
          hasWarning: i.pregnancyWarning,
          details: i.pregnancyWarningDetails || undefined,
        }
      : undefined,
    lactationWarning: i.lactationWarning
      ? {
          hasWarning: i.lactationWarning,
          details: i.lactationWarningDetails || undefined,
        }
      : undefined,
    contraindicatedConditions: i.contraindicatedConditions as string[] | undefined,
    source: i.source as any,
    confidenceScore: i.confidenceScore ? Number(i.confidenceScore) : undefined,
  }));
}
