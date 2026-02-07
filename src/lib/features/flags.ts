/**
 * Feature Flags System (Entitlement-Driven)
 * 
 * Server-side feature flags embedded in entitlements.
 * Client uses flags only to show/hide UI.
 * Server enforces flags on endpoints.
 */

import { prisma } from "@/lib/prisma";

export type FeatureName =
  | 'drug_scan'
  | 'rx_ocr'
  | 'gst_engine'
  | 'offline_pos'
  | 'inventory_ai'
  | 'export_pdf'
  | 'team_seats'
  | 'support_sessions';

export interface FeatureFlag {
  featureName: FeatureName;
  displayName: string;
  description: string;
  category: 'CORE' | 'PREMIUM' | 'ENTERPRISE';
  isEnabled: boolean;
}

/**
 * Get all feature flags for an org/license
 * Checks: global flags → org overrides → license overrides
 */
export async function getFeatureFlags(
  orgId: string,
  licenseId: string | null
): Promise<Record<FeatureName, boolean>> {
  // Get all global flags
  const globalFlags = await prisma.featureFlag.findMany();

  // Get org overrides
  const orgOverrides = await prisma.orgFeatureOverride.findMany({
    where: { orgId },
    include: { feature: true },
  });

  // Get license overrides
  const licenseOverrides = licenseId
    ? await prisma.licenseFeatureOverride.findMany({
        where: { licenseId },
        include: { feature: true },
      })
    : [];

  const flags: Record<string, boolean> = {};

  // Start with global defaults
  for (const flag of globalFlags) {
    flags[flag.featureName] = flag.isEnabledByDefault;
  }

  // Apply org overrides
  for (const override of orgOverrides) {
    flags[override.feature.featureName] = override.isEnabled;
  }

  // Apply license overrides (highest priority)
  for (const override of licenseOverrides) {
    flags[override.feature.featureName] = override.isEnabled;
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
  return flags[featureName] || false;
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
    throw new Error(`Feature ${featureName} is not enabled for this organization`);
  }
}

/**
 * Set org-level feature override (admin only)
 */
export async function setOrgFeatureOverride(
  orgId: string,
  featureName: FeatureName,
  isEnabled: boolean,
  enabledBy: string
): Promise<void> {
  // Get or create feature flag
  let feature = await prisma.featureFlag.findUnique({
    where: { featureName },
  });

  if (!feature) {
    // Create default feature flag
    feature = await prisma.featureFlag.create({
      data: {
        featureName,
        displayName: featureName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: `Feature: ${featureName}`,
        category: 'CORE',
        isEnabledByDefault: false,
      },
    });
  }

  // Create or update org override
  await prisma.orgFeatureOverride.upsert({
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
}

/**
 * Set license-level feature override (admin only)
 */
export async function setLicenseFeatureOverride(
  licenseId: string,
  featureName: FeatureName,
  isEnabled: boolean,
  enabledBy: string
): Promise<void> {
  // Get or create feature flag
  let feature = await prisma.featureFlag.findUnique({
    where: { featureName },
  });

  if (!feature) {
    feature = await prisma.featureFlag.create({
      data: {
        featureName,
        displayName: featureName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: `Feature: ${featureName}`,
        category: 'CORE',
        isEnabledByDefault: false,
      },
    });
  }

  // Create or update license override
  await prisma.licenseFeatureOverride.upsert({
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
}

/**
 * Initialize default feature flags
 */
export async function initializeDefaultFeatureFlags(): Promise<void> {
  const defaultFlags: Array<{
    featureName: FeatureName;
    displayName: string;
    description: string;
    category: 'CORE' | 'PREMIUM' | 'ENTERPRISE';
    isEnabledByDefault: boolean;
  }> = [
    {
      featureName: 'drug_scan',
      displayName: 'Drug Scanning',
      description: 'Scan drugs using barcode/QR/GS1 DataMatrix',
      category: 'CORE',
      isEnabledByDefault: true,
    },
    {
      featureName: 'rx_ocr',
      displayName: 'Prescription OCR',
      description: 'Optical character recognition for prescriptions',
      category: 'PREMIUM',
      isEnabledByDefault: false,
    },
    {
      featureName: 'gst_engine',
      displayName: 'GST Engine',
      description: 'GST calculation and compliance',
      category: 'CORE',
      isEnabledByDefault: true,
    },
    {
      featureName: 'offline_pos',
      displayName: 'Offline POS',
      description: 'Point of sale works offline',
      category: 'PREMIUM',
      isEnabledByDefault: false,
    },
    {
      featureName: 'inventory_ai',
      displayName: 'Inventory AI',
      description: 'AI-powered inventory management',
      category: 'ENTERPRISE',
      isEnabledByDefault: false,
    },
    {
      featureName: 'export_pdf',
      displayName: 'PDF Export',
      description: 'Export invoices and reports as PDF',
      category: 'CORE',
      isEnabledByDefault: true,
    },
    {
      featureName: 'team_seats',
      displayName: 'Team Seats',
      description: 'Multiple user accounts per organization',
      category: 'PREMIUM',
      isEnabledByDefault: false,
    },
    {
      featureName: 'support_sessions',
      displayName: 'Support Sessions',
      description: 'Secure remote support access',
      category: 'ENTERPRISE',
      isEnabledByDefault: false,
    },
  ];

  for (const flag of defaultFlags) {
    await prisma.featureFlag.upsert({
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
