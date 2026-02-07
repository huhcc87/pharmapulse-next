// AI Customer Health Advisor
// Personalized health recommendations, symptom analysis, medication adherence
// Optimized for Indian market (common ailments, local health patterns)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface HealthRecommendation {
  type: "PREVENTIVE" | "VITAMIN" | "SUPPLEMENT" | "OTC" | "LIFESTYLE";
  productId?: number;
  productName: string;
  reason: string;
  confidence: number; // 0-100
  urgency: "LOW" | "MEDIUM" | "HIGH";
}

export interface SymptomAnalysisResult {
  possibleConditions: Array<{
    condition: string;
    probability: number; // 0-100
    severity: "MILD" | "MODERATE" | "SEVERE";
    recommendation: string;
  }>;
  suggestedOTCs: Array<{
    productName: string;
    productId?: number;
    reason: string;
  }>;
  requiresDoctorVisit: boolean;
  urgencyLevel: "LOW" | "MEDIUM" | "HIGH" | "EMERGENCY";
  disclaimer: string;
}

/**
 * Generate personalized health recommendations
 * Based on purchase history, age, health patterns
 */
export async function generateHealthRecommendations(
  customerId: number,
  tenantId: number = 1
): Promise<HealthRecommendation[]> {
  try {
    const recommendations: HealthRecommendation[] = [];

    // Get customer data
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        prescriptions: {
          include: {
            lines: true,
          },
          orderBy: {
            date: "desc",
          },
          take: 10,
        },
        invoices: {
          include: {
            lineItems: true,
          },
          orderBy: {
            invoiceDate: "desc",
          },
          take: 50,
        },
      },
    });

    if (!customer) {
      return [];
    }

    // 1. Age-based recommendations
    if (customer.dob) {
      const age = calculateAge(customer.dob);
      
      // Vitamin D for older adults (Indian population often deficient)
      if (age >= 50) {
        recommendations.push({
          type: "VITAMIN",
          productName: "Vitamin D3 60K IU",
          reason: `You're ${age} years old. Vitamin D is essential for bone health and immune function.`,
          confidence: 85,
          urgency: "MEDIUM",
        });
      }

      // Calcium for women 30+
      if (age >= 30 && age < 50) {
        recommendations.push({
          type: "SUPPLEMENT",
          productName: "Calcium + Vitamin D3",
          reason: "Maintains bone health and prevents osteoporosis",
          confidence: 75,
          urgency: "LOW",
        });
      }
    }

    // 2. Purchase pattern analysis
    const purchasePattern = analyzePurchasePattern(customer.invoices || []);
    
    // Frequent pain killers → Suggest preventive care
    if (purchasePattern.frequentPainkillers) {
      recommendations.push({
        type: "PREVENTIVE",
        productName: "Joint Health Supplement (Glucosamine + Chondroitin)",
        reason: "You frequently purchase pain relief. Consider preventive joint health supplements.",
        confidence: 80,
        urgency: "MEDIUM",
      });
    }

    // Frequent antibiotics → Probiotics
    if (purchasePattern.frequentAntibiotics) {
      recommendations.push({
        type: "SUPPLEMENT",
        productName: "Probiotics",
        reason: "Antibiotics can disrupt gut health. Probiotics help restore healthy bacteria.",
        confidence: 90,
        urgency: "MEDIUM",
      });
    }

    // Frequent cough/cold → Immunity boosters
    if (purchasePattern.frequentColdMedicine) {
      recommendations.push({
        type: "VITAMIN",
        productName: "Vitamin C + Zinc",
        reason: "Boosts immunity and helps prevent frequent colds",
        confidence: 85,
        urgency: "MEDIUM",
      });
    }

    // 3. Seasonal recommendations (Indian market)
    const season = getCurrentIndianSeason();
    
    if (season === "MONSOON") {
      recommendations.push({
        type: "PREVENTIVE",
        productName: "Vitamin C + Echinacea",
        reason: "Monsoon season increases risk of infections. Boost your immunity.",
        confidence: 80,
        urgency: "MEDIUM",
      });
    }

    if (season === "WINTER") {
      recommendations.push({
        type: "VITAMIN",
        productName: "Vitamin D3",
        reason: "Winter reduces sunlight exposure. Vitamin D helps maintain energy levels.",
        confidence: 85,
        urgency: "LOW",
      });
    }

    // 4. Prescription analysis
    if (customer.prescriptions && customer.prescriptions.length > 0) {
      const chronicMeds = customer.prescriptions
        .flatMap((p) => p.lines)
        .map((l) => l.drugName.toLowerCase());

      // Diabetics → Blood sugar monitoring supplies
      if (chronicMeds.some((m) => m.includes("metformin") || m.includes("glimepiride"))) {
        recommendations.push({
          type: "PREVENTIVE",
          productName: "Blood Glucose Monitor Strips",
          reason: "Regular monitoring is essential for diabetes management",
          confidence: 95,
          urgency: "HIGH",
        });
      }

      // Hypertension → Salt-free alternatives
      if (chronicMeds.some((m) => m.includes("amlodipine") || m.includes("telmisartan"))) {
        recommendations.push({
          type: "LIFESTYLE",
          productName: "Low Sodium Salt Substitute",
          reason: "Managing sodium intake helps control blood pressure",
          confidence: 90,
          urgency: "MEDIUM",
        });
      }
    }

    // 5. Allergies-based recommendations
    if (customer.allergies) {
      try {
        const allergies = JSON.parse(customer.allergies) as string[];
        
        if (allergies.some((a) => a.toLowerCase().includes("dust") || a.toLowerCase().includes("pollen"))) {
          recommendations.push({
            type: "OTC",
            productName: "Antihistamine (Cetirizine)",
            reason: "Keep antihistamines handy for allergy flare-ups",
            confidence: 90,
            urgency: "MEDIUM",
          });
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Sort by urgency and confidence
    return recommendations.sort((a, b) => {
      const urgencyOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
      }
      return b.confidence - a.confidence;
    });
  } catch (error: any) {
    console.error("Generate health recommendations error:", error);
    return [];
  }
}

/**
 * Analyze symptoms and suggest OTC medicines
 * Includes disclaimers for Indian market compliance
 */
export async function analyzeSymptoms(
  symptoms: string[],
  patientAge?: number
): Promise<SymptomAnalysisResult> {
  // Indian market common symptoms mapping
  const symptomConditions: Record<string, Array<{
    condition: string;
    probability: number;
    severity: "MILD" | "MODERATE" | "SEVERE";
    otcs: string[];
  }>> = {
    "fever": [
      {
        condition: "Viral Fever",
        probability: 70,
        severity: "MILD",
        otcs: ["Paracetamol 500mg", "Crocin"],
      },
    ],
    "cough": [
      {
        condition: "Common Cold",
        probability: 60,
        severity: "MILD",
        otcs: ["Cough Syrup", "Lozenges"],
      },
      {
        condition: "Allergic Cough",
        probability: 40,
        severity: "MILD",
        otcs: ["Antihistamine (Cetirizine)"],
      },
    ],
    "headache": [
      {
        condition: "Tension Headache",
        probability: 70,
        severity: "MILD",
        otcs: ["Paracetamol 500mg", "Ibuprofen 400mg"],
      },
    ],
    "stomach pain": [
      {
        condition: "Indigestion",
        probability: 60,
        severity: "MILD",
        otcs: ["Antacid (Digene)", "Gas Relief"],
      },
    ],
  };

  const possibleConditions: SymptomAnalysisResult["possibleConditions"] = [];
  const suggestedOTCs: SymptomAnalysisResult["suggestedOTCs"] = [];
  const seenOTCs = new Set<string>();

  for (const symptom of symptoms) {
    const lowerSymptom = symptom.toLowerCase();
    const conditions = symptomConditions[lowerSymptom] || [];

    for (const cond of conditions) {
      possibleConditions.push({
        condition: cond.condition,
        probability: cond.probability,
        severity: cond.severity,
        recommendation: `For ${cond.condition}, try OTC medicines: ${cond.otcs.join(", ")}`,
      });

      for (const otc of cond.otcs) {
        if (!seenOTCs.has(otc)) {
          suggestedOTCs.push({
            productName: otc,
            reason: `Recommended for ${symptom}`,
          });
          seenOTCs.add(otc);
        }
      }
    }
  }

  // Determine urgency
  const hasSevere = possibleConditions.some((c) => c.severity === "SEVERE");
  const urgencyLevel = hasSevere ? "HIGH" : 
    possibleConditions.some((c) => c.severity === "MODERATE") ? "MEDIUM" : "LOW";

  // Indian market disclaimer
  const disclaimer = `⚠️ DISCLAIMER: This is not a substitute for professional medical advice. 
    For persistent symptoms, high fever (>101°F), severe pain, or symptoms lasting more than 3 days, 
    please consult a qualified doctor. OTC medicines should be used only for mild, self-limiting conditions.`;

  return {
    possibleConditions: possibleConditions.slice(0, 3), // Top 3
    suggestedOTCs: suggestedOTCs.slice(0, 5), // Top 5
    requiresDoctorVisit: hasSevere || (patientAge && patientAge < 12), // Children should see doctor
    urgencyLevel,
    disclaimer,
  };
}

// Helper functions

function calculateAge(dob: Date): number {
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function analyzePurchasePattern(invoices: any[]): {
  frequentPainkillers: boolean;
  frequentAntibiotics: boolean;
  frequentColdMedicine: boolean;
} {
  const painKillerKeywords = ["paracetamol", "ibuprofen", "diclofenac", "crocin", "combiflam"];
  const antibioticKeywords = ["amoxicillin", "azithromycin", "ciprofloxacin", "doxycycline"];
  const coldKeywords = ["cough", "cold", "fever", "lozenge"];

  const allProducts = invoices
    .flatMap((inv) => inv.lineItems || [])
    .map((item: any) => item.productName?.toLowerCase() || "");

  const painKillerCount = allProducts.filter((p) =>
    painKillerKeywords.some((kw) => p.includes(kw))
  ).length;
  
  const antibioticCount = allProducts.filter((p) =>
    antibioticKeywords.some((kw) => p.includes(kw))
  ).length;
  
  const coldCount = allProducts.filter((p) =>
    coldKeywords.some((kw) => p.includes(kw))
  ).length;

  return {
    frequentPainkillers: painKillerCount >= 5, // 5+ purchases
    frequentAntibiotics: antibioticCount >= 3, // 3+ purchases
    frequentColdMedicine: coldCount >= 4, // 4+ purchases
  };
}

function getCurrentIndianSeason(): "SUMMER" | "MONSOON" | "WINTER" {
  const month = new Date().getMonth() + 1; // 1-12
  
  if (month >= 3 && month <= 5) {
    return "SUMMER"; // March-May
  } else if (month >= 6 && month <= 9) {
    return "MONSOON"; // June-September
  } else {
    return "WINTER"; // October-February
  }
}
