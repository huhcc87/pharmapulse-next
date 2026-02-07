"use client";

import Link from "next/link";
import { Package, TrendingUp, AlertTriangle, ExternalLink } from "lucide-react";

type InsightData = {
  topMovingSkus: Array<{ name: string; qty: number }>;
  deadStockCount: number;
  expiryBuckets: {
    "0_30": number;
    "30_90": number;
    "90_plus": number;
  };
};

type Props = {
  data: InsightData;
  loading?: boolean;
};

export function InventoryInsights({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-lg border bg-white p-4">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4 animate-pulse"></div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Package className="w-5 h-5 text-gray-600" />
          Inventory Insights
        </h3>
        <Link
          href="/inventory"
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          View all <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-4">
        {/* Expiry Buckets */}
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">Expiry Timeline</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-gray-600">0-30 days</span>
              </div>
              <span className="font-semibold">{data.expiryBuckets["0_30"]}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span className="text-gray-600">30-90 days</span>
              </div>
              <span className="font-semibold">{data.expiryBuckets["30_90"]}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-green-500" />
                <span className="text-gray-600">90+ days</span>
              </div>
              <span className="font-semibold">{data.expiryBuckets["90_plus"]}</span>
            </div>
          </div>
        </div>

        {/* Dead Stock */}
        {data.deadStockCount > 0 && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Dead Stock Items</span>
              <span className="font-semibold text-orange-600">{data.deadStockCount}</span>
            </div>
          </div>
        )}

        {/* Top Moving SKUs */}
        <div className="pt-2 border-t">
          <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Top Moving Items (MTD)
          </div>
          {data.topMovingSkus.length === 0 ? (
            <div className="text-sm text-gray-500 py-2">No sales data available</div>
          ) : (
            <div className="space-y-2">
              {data.topMovingSkus.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 truncate flex-1 mr-2">{item.name}</span>
                  <span className="font-semibold text-gray-900">{item.qty} units</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}






