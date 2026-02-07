// Product cache sync utilities
// Handles bulk cache pre-loading and sync strategies

import { cacheProducts, getCacheStats } from "./product-cache";

export interface PreloadCacheResult {
  success: boolean;
  cached: number;
  failed: number;
  errors: string[];
}

/**
 * Pre-load products into cache from API
 */
export async function preloadProductCache(
  strategy: "POPULAR" | "FAST_MOVING" | "ALL_WITH_BARCODE" | "CUSTOM" = "POPULAR",
  productIds?: number[],
  barcodes?: string[]
): Promise<PreloadCacheResult> {
  const result: PreloadCacheResult = {
    success: false,
    cached: 0,
    failed: 0,
    errors: [],
  };

  try {
    const body: any = { strategy };
    if (productIds && productIds.length > 0) {
      body.productIds = productIds;
    }
    if (barcodes && barcodes.length > 0) {
      body.barcodes = barcodes;
    }

    const res = await fetch("/api/offline/preload-cache", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      result.errors.push(data.error || "Preload failed");
      return result;
    }

    // Cache products
    if (data.products && data.products.length > 0) {
      try {
        await cacheProducts(data.products);
        result.cached = data.products.length;
        result.success = true;
      } catch (cacheError: any) {
        result.failed = data.products.length;
        result.errors.push(`Cache error: ${cacheError.message}`);
      }
    }

    return result;
  } catch (error: any) {
    result.errors.push(error.message || "Preload cache failed");
    return result;
  }
}

/**
 * Get cache statistics and suggest pre-load strategy
 */
export async function getCacheSyncRecommendations(): Promise<{
  stats: { count: number; oldestCachedAt: number | null };
  recommendations: string[];
  shouldPreload: boolean;
}> {
  const stats = await getCacheStats();
  const recommendations: string[] = [];
  let shouldPreload = false;

  // Check cache size
  if (stats.count === 0) {
    recommendations.push("Cache is empty. Pre-load products for offline use.");
    shouldPreload = true;
  } else if (stats.count < 50) {
    recommendations.push(`Cache has only ${stats.count} products. Consider pre-loading more for better offline experience.`);
    shouldPreload = true;
  }

  // Check cache age
  if (stats.oldestCachedAt) {
    const ageDays = (Date.now() - stats.oldestCachedAt) / (1000 * 60 * 60 * 24);
    if (ageDays > 7) {
      recommendations.push(`Cache is ${Math.floor(ageDays)} days old. Consider refreshing for up-to-date prices.`);
      shouldPreload = true;
    }
  }

  return {
    stats,
    recommendations,
    shouldPreload,
  };
}

/**
 * Sync cache incrementally (for background sync)
 */
export async function syncCacheIncremental(): Promise<PreloadCacheResult> {
  // Pre-load popular products (last 30 days)
  return preloadProductCache("POPULAR");
}

/**
 * Clear and rebuild cache with fresh data
 */
export async function rebuildCache(): Promise<PreloadCacheResult> {
  // Clear old cache first (optional - can be done via getCacheStats and manual clear)
  // Then pre-load fresh data
  return preloadProductCache("ALL_WITH_BARCODE");
}
