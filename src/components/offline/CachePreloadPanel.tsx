"use client";

import { useState, useEffect } from "react";
import { Download, RefreshCw, Database, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCacheStats, clearOldCache } from "@/lib/offline/product-cache";
import { preloadProductCache, getCacheSyncRecommendations, type PreloadCacheResult } from "@/lib/offline/cache-sync";
import { showToast } from "@/lib/toast";

export default function CachePreloadPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [stats, setStats] = useState<{ count: number; oldestCachedAt: number | null }>({ count: 0, oldestCachedAt: null });
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [lastPreload, setLastPreload] = useState<PreloadCacheResult | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const statsData = await getCacheStats();
      setStats(statsData);
      
      const recommendationsData = await getCacheSyncRecommendations();
      setRecommendations(recommendationsData.recommendations);
    } catch (error) {
      console.error("Failed to load cache stats:", error);
    }
  }

  async function handlePreload(strategy: "POPULAR" | "FAST_MOVING" | "ALL_WITH_BARCODE" = "POPULAR") {
    setIsPreloading(true);
    try {
      const result = await preloadProductCache(strategy);
      setLastPreload(result);
      
      if (result.success) {
        showToast(`Successfully cached ${result.cached} products`, "success");
        await loadStats(); // Refresh stats
      } else {
        showToast(`Preload failed: ${result.errors.join(", ")}`, "error");
      }
    } catch (error: any) {
      showToast(error.message || "Preload failed", "error");
    } finally {
      setIsPreloading(false);
    }
  }

  async function handleClearOldCache() {
    setIsLoading(true);
    try {
      await clearOldCache(30 * 24 * 60 * 60 * 1000); // 30 days
      showToast("Old cache cleared", "success");
      await loadStats();
    } catch (error: any) {
      showToast(error.message || "Failed to clear cache", "error");
    } finally {
      setIsLoading(false);
    }
  }

  const cacheAgeDays = stats.oldestCachedAt
    ? Math.floor((Date.now() - stats.oldestCachedAt) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          Offline Product Cache
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cache Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">Cached Products</div>
            <div className="text-2xl font-bold">{stats.count}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">Cache Age</div>
            <div className="text-2xl font-bold">
              {cacheAgeDays !== null ? `${cacheAgeDays}d` : "N/A"}
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-yellow-800 mb-1">Recommendations</div>
                <ul className="text-xs text-yellow-700 space-y-1">
                  {recommendations.map((rec, idx) => (
                    <li key={idx}>• {rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Last Preload Result */}
        {lastPreload && (
          <div className={`p-3 rounded-lg ${
            lastPreload.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {lastPreload.success ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600" />
              )}
              <div className="flex-1 text-sm">
                {lastPreload.success ? (
                  <span className="text-green-700">
                    Last preload: {lastPreload.cached} products cached successfully
                  </span>
                ) : (
                  <span className="text-red-700">
                    Last preload failed: {lastPreload.errors.join(", ")}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pre-load Actions */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">Pre-load Cache</div>
          <div className="grid grid-cols-1 gap-2">
            <Button
              onClick={() => handlePreload("POPULAR")}
              disabled={isPreloading}
              className="w-full"
              variant="outline"
            >
              {isPreloading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Pre-loading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Pre-load Popular Products (Last 30 Days)
                </>
              )}
            </Button>
            <Button
              onClick={() => handlePreload("ALL_WITH_BARCODE")}
              disabled={isPreloading}
              className="w-full"
              variant="outline"
            >
              {isPreloading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Pre-loading...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Pre-load All Products (with barcodes)
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Pre-loading products enables offline barcode scanning. Popular products are recommended for faster sync.
          </p>
        </div>

        {/* Maintenance */}
        <div className="pt-2 border-t">
          <Button
            onClick={handleClearOldCache}
            disabled={isLoading}
            variant="ghost"
            size="sm"
            className="w-full"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Clearing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Clear Old Cache (30+ days)
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
