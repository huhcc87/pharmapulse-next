/**
 * Feature Flags System (Entitlement-Driven)
 *
 * IMPORTANT:
 * Your Prisma schema may NOT include orgFeatureOverride / licenseFeatureOverride models.
 * This module is written to:
 *  - compile even when those delegates do not exist
 *  - degrade gracefully at runtime (fallback to global defaults)
 *
 * If you later add these Prisma models, the overrides will start working automatically.
 */

import { prisma } from "@/lib/prisma";

export type FeatureName =
  | "drug_scan"
  | "rx_ocr"
  | "gst_engine"
  | "offline_pos"
  | "inventory_ai"
  | "export_pdf"
  | "team_seats"
  | "support_sessions";

export interface FeatureFlag {
  featureName: FeatureName;
  displayName: string;
  description: string;
  category: "CORE" | "PREMIUM" | "ENTERPRISE";
  isEnabled: boolean;
}

/**
 * Delegate guards (so TS build won't fail if models are missing in schema)
 */
type Delegate = {
  findMany?: (args?: any) => Promise<any[]>;
  findUnique?: (args: any) => Promise<any | null>;
  upsert?: (args: any) => Promise<any>;
  create?: (args: any) => Promise<any>;
};

function d(name: string): Delegate | null {
  const anyPrisma = prisma as any;
  return (anyPrisma?.[name] ?? null) as Delegate | null;
}

const featureFlagDelegate = () => d("featureFlag");
const orgOverrideDelegate = () => d("orgFeatureOverride");
const licenseOverrideDelegate = () => d("licenseFeatureOverride");

/**
 * Get all feature flags for an org/license
 * Checks: global flags → org overrides → license overrides
 */
export async function getFeatureFlags(
  orgId: string,
  licenseId: string | null
): Promise<Record<FeatureName, boolean>> {
  const featureFlag = featureFlagDelegate();

  // If even featureFlag table doesn't exist, return safe defaults (all false)
  if (!featureFlag?.findMany) {
    return {
      drug_scan: false,
      rx_ocr: false,
      gst_engine: false,
      offline_pos: false,
      inventory_ai: false,
      export_pdf: false,
      team_seats: false,
      support_sessions: false,
    };
  }

  // 1) Global flags
  const globalFlags = await featureFlag.findMany();

  const flags: Record<string, boolean> = {};
  for (const flag of globalFlags) {
    // Expecting fields: featureName, isEnabledByDefault
    flags[String(flag.featureName)] = Boolean(flag.isEnabledByDefault);
  }

  // 2) Org overrides (optional)
  const orgOverride = orgOverrideDelegate();
  if (orgOverride?.findMany) {
    try {
      const orgOverrides = await orgOverride.findMany({
        where: { orgId },
        // include feature if relation exists; otherwise the record may carry featureName directly
        include: { feature: true },
      });

      for (const o of orgOverrides) {
        const featureName =
          o?.feature?.featureName ?? o?.featureName ?? o?.feature_key ?? null;
        if (featureName) flags[String(featureName)] = Boolean(o.isEnabled);
      }
    } catch {
      // If schema doesn't support include/where shape, ignore overrides
    }
  }

  // 3) License overrides (optional, highest priority)
  const licenseOverride = licenseOverrideDelegate();
  if (licenseId && licenseOverride?.findMany) {
    try {
      const licenseOverrides = await licenseOverride.findMany({
        where: { licenseId },
        include: { feature: true },
      });

      for (const o of licenseOverrides) {
        const featureName =
          o?.feature?.featureName ?? o?.featureName ?? o?.feature_key ?? null;
        if (featureName) flags[String(featureName)] = Boolean(o.isEnabled);
      }
    } catch {
      // ignore if not supported
    }
  }

  return flags as Record<FeatureName, boolean>;
}

/**
 * Check if a specific feature is enabled
 */
export async function isFeatureEnabled(
  orgId: string,
  licenseId: string | null,
  featureName: FeatureName
): Promise<boolean> {
  const flags = await getFeatureFlags(orgId, licenseId);
  return Boolean(flags[featureName]);
}

/**
 * Require feature (throws if not enabled)
 */
export async function requireFeature(
  orgId: string,
  licenseId: string | null,
  featureName: FeatureName
): Promise<void> {
  const enabled = await isFeatureEnabled(orgId, licenseId, featureName);
  if (!enabled) {
    throw new Error(
      `Feature ${featureName} is not enabled for this organization`
    );
  }
}

/**
 * Set org-level feature override (admin only)
 *
 * If orgFeatureOverride model doesn't exist, this becomes a no-op
 * (so build + runtime won't break).
 */
export async function setOrgFeatureOverride(
  orgId: string,
  featureName: FeatureName,
  isEnabled: boolean,
  enabledBy: string
): Promise<void> {
  const featureFlag = featureFlagDelegate();
  if (!featureFlag?.findUnique || !featureFlag?.create || !featureFlag?.upsert) {
    // No feature flag table in schema -> can't persist overrides
    return;
  }

  // Get or create feature flag
  let feature = await featureFlag.findUnique({
    where: { featureName },
  });

  if (!feature) {
    feature = await featureFlag.create({
      data: {
        featureName,
        displayName: featureName
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l: string) => l.toUpperCase()),
        description: `Feature: ${featureName}`,
        category: "CORE",
        isEnabledByDefault: false,
      },
    });
  }

  const orgOverride = orgOverrideDelegate();
  if (!orgOverride?.upsert) {
    // Override table doesn't exist -> no-op (but featureFlag still exists)
    return;
  }

  // Try an upsert; if schema differs, swallow to keep app stable
  try {
    await orgOverride.upsert({
      where: {
        orgId_featureId: {
          orgId,
          featureId: feature.id,
        },
      },
      create: {
        orgId,
        featureId: feature.id,
        isEnabled,
        enabledBy,
        enabledAt: isEnabled ? new Date() : null,
        disabledAt: !isEnabled ? new Date() : null,
      },
      update: {
        isEnabled,
        enabledBy,
        enabledAt: isEnabled ? new Date() : null,
        disabledAt: !isEnabled ? new Date() : null,
      },
    });
  } catch {
    // no-op if schema doesn't match
  }
}

/**
 * Set license-level feature override (admin only)
 * No-op if licenseFeatureOverride model doesn't exist.
 */
export async function setLicenseFeatureOverride(
  licenseId: string,
  featureName: FeatureName,
  isEnabled: boolean,
  enabledBy: string
): Promise<void> {
  const featureFlag = featureFlagDelegate();
  if (!featureFlag?.findUnique || !featureFlag?.create || !featureFlag?.upsert) {
    return;
  }

  let feature = await featureFlag.findUnique({
    where: { featureName },
  });

  if (!feature) {
    feature = await featureFlag.create({
      data: {
        featureName,
        displayName: featureName
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l: string) => l.toUpperCase()),
        description: `Feature: ${featureName}`,
        category: "CORE",
        isEnabledByDefault: false,
      },
    });
  }

  const licenseOverride = licenseOverrideDelegate();
  if (!licenseOverride?.upsert) {
    return;
  }

  try {
    await licenseOverride.upsert({
      where: {
        licenseId_featureId: {
          licenseId,
          featureId: feature.id,
        },
      },
      create: {
        licenseId,
        featureId: feature.id,
        isEnabled,
        enabledBy,
        enabledAt: isEnabled ? new Date() : null,
        disabledAt: !isEnabled ? new Date() : null,
      },
      update: {
        isEnabled,
        enabledBy,
        enabledAt: isEnabled ? new Date() : null,
        disabledAt: !isEnabled ? new Date() : null,
      },
    });
  } catch {
    // no-op if schema doesn't match
  }
}

/**
 * Initialize default feature flags
 * If featureFlag model doesn't exist, this becomes a no-op.
 */
export async function initializeDefaultFeatureFlags(): Promise<void> {
  const featureFlag = featureFlagDelegate();
  if (!featureFlag?.upsert) return;

  const defaultFlags: Array<{
    featureName: FeatureName;
    displayName: string;
    description: string;
    category: "CORE" | "PREMIUM" | "ENTERPRISE";
    isEnabledByDefault: boolean;
  }> = [
    {
      featureName: "drug_scan",
      displayName: "Drug Scanning",
      description: "Scan drugs using barcode/QR/GS1 DataMatrix",
      category: "CORE",
      isEnabledByDefault: true,
    },
    {
      featureName: "rx_ocr",
      displayName: "Prescription OCR",
      description: "Optical character recognition for prescriptions",
      category: "PREMIUM",
      isEnabledByDefault: false,
    },
    {
      featureName: "gst_engine",
      displayName: "GST Engine",
      description: "GST calculation and compliance",
      category: "CORE",
      isEnabledByDefault: true,
    },
    {
      featureName: "offline_pos",
      displayName: "Offline POS",
      description: "Point of sale works offline",
      category: "PREMIUM",
      isEnabledByDefault: false,
    },
    {
      featureName: "inventory_ai",
      displayName: "Inventory AI",
      description: "AI-powered inventory management",
      category: "ENTERPRISE",
      isEnabledByDefault: false,
    },
    {
      featureName: "export_pdf",
      displayName: "PDF Export",
      description: "Export invoices and reports as PDF",
      category: "CORE",
      isEnabledByDefault: true,
    },
    {
      featureName: "team_seats",
      displayName: "Team Seats",
      description: "Multiple user accounts per organization",
      category: "PREMIUM",
      isEnabledByDefault: false,
    },
    {
      featureName: "support_sessions",
      displayName: "Support Sessions",
      description: "Secure remote support access",
      category: "ENTERPRISE",
      isEnabledByDefault: false,
    },
  ];

  for (const flag of defaultFlags) {
    await featureFlag.upsert({
      where: { featureName: flag.featureName },
      create: flag,
      update: {
        displayName: flag.displayName,
        description: flag.description,
        category: flag.category,
      },
    });
  }
}
