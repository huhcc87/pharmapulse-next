// Subscription feature flags and limits

export interface SubscriptionFeatures {
  aiCopilot: boolean;
  rxOcr: boolean;
  offlinePos: boolean;
  demandForecasting: boolean;
  advancedReports: boolean;
  apiAccess: boolean;
  customIntegrations: boolean;
}

export interface PlanConfig {
  name: string;
  priceMonthly: number;
  priceYearly: number;
  features: SubscriptionFeatures;
  aiCreditsPerMonth: number;
  maxUsers: number;
  maxBranches: number;
}

// Plan definitions
export const PLAN_CONFIGS: Record<string, PlanConfig> = {
  free: {
    name: "Free",
    priceMonthly: 0,
    priceYearly: 0,
    features: {
      aiCopilot: false,
      rxOcr: false,
      offlinePos: false,
      demandForecasting: false,
      advancedReports: false,
      apiAccess: false,
      customIntegrations: false,
    },
    aiCreditsPerMonth: 0,
    maxUsers: 1,
    maxBranches: 1,
  },
  basic: {
    name: "Basic",
    priceMonthly: 999, // ₹999/month
    priceYearly: 9999, // ₹9,999/year
    features: {
      aiCopilot: false,
      rxOcr: false,
      offlinePos: false,
      demandForecasting: false,
      advancedReports: false,
      apiAccess: false,
      customIntegrations: false,
    },
    aiCreditsPerMonth: 0,
    maxUsers: 3,
    maxBranches: 1,
  },
  professional: {
    name: "Professional",
    priceMonthly: 2999, // ₹2,999/month
    priceYearly: 29999, // ₹29,999/year
    features: {
      aiCopilot: true,
      rxOcr: true,
      offlinePos: true,
      demandForecasting: true,
      advancedReports: true,
      apiAccess: false,
      customIntegrations: false,
    },
    aiCreditsPerMonth: 1000,
    maxUsers: 10,
    maxBranches: 3,
  },
  enterprise: {
    name: "Enterprise",
    priceMonthly: 9999, // ₹9,999/month
    priceYearly: 99999, // ₹99,999/year
    features: {
      aiCopilot: true,
      rxOcr: true,
      offlinePos: true,
      demandForecasting: true,
      advancedReports: true,
      apiAccess: true,
      customIntegrations: true,
    },
    aiCreditsPerMonth: 10000,
    maxUsers: -1, // Unlimited
    maxBranches: -1, // Unlimited
  },
};

/**
 * Get default features for a plan
 */
export function getPlanFeatures(planName: string): SubscriptionFeatures {
  const config = PLAN_CONFIGS[planName.toLowerCase()];
  if (!config) {
    // Default to basic if plan not found
    return PLAN_CONFIGS.basic.features;
  }
  return config.features;
}

/**
 * Get AI credits allocation for a plan
 */
export function getPlanAiCredits(planName: string): number {
  const config = PLAN_CONFIGS[planName.toLowerCase()];
  if (!config) {
    return 0;
  }
  return config.aiCreditsPerMonth;
}

/**
 * Check if feature is enabled for subscription
 */
export function hasFeature(
  features: SubscriptionFeatures | null | undefined,
  feature: keyof SubscriptionFeatures
): boolean {
  if (!features) return false;
  return features[feature] === true;
}
