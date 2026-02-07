"use client";

import Link from "next/link";
import { calculateScanSuccessRate } from "@/lib/dashboard/metrics";
import { Barcode, CheckCircle, XCircle, ExternalLink } from "lucide-react";

type PosData = {
  scanSuccessToday: number;
  scanFailToday: number;
  unmappedBarcodes: number;
};

type Props = {
  data: PosData;
  loading?: boolean;
};

export function PosBarcodeHealth({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-lg border bg-white p-4">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4 animate-pulse"></div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  const successRate = calculateScanSuccessRate(data.scanSuccessToday, data.scanFailToday);
  const totalScans = data.scanSuccessToday + data.scanFailToday;

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Barcode className="w-5 h-5 text-gray-600" />
          POS & Barcode Health
        </h3>
        <Link
          href="/pos"
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          View POS <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-4">
        {/* Scan Success Rate */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Scan Success Rate (Today)</span>
            <span className="text-lg font-semibold">{successRate}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                successRate >= 90 ? "bg-green-500" : successRate >= 70 ? "bg-yellow-500" : "bg-red-500"
              }`}
              style={{ width: `${successRate}%` }}
            />
          </div>
          {totalScans > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              {data.scanSuccessToday} successful, {data.scanFailToday} failed
            </div>
          )}
        </div>

        {/* Scan Stats */}
        <div className="pt-2 border-t space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-gray-600">Successful Scans (Today)</span>
            </div>
            <span className="font-semibold text-green-600">{data.scanSuccessToday}</span>
          </div>
          {data.scanFailToday > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" />
                <span className="text-gray-600">Failed Scans (Today)</span>
              </div>
              <span className="font-semibold text-red-600">{data.scanFailToday}</span>
            </div>
          )}
          {data.unmappedBarcodes > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Barcode className="w-4 h-4 text-orange-600" />
                <span className="text-gray-600">Unmapped Barcodes</span>
              </div>
              <span className="font-semibold text-orange-600">{data.unmappedBarcodes}</span>
            </div>
          )}
        </div>

        {totalScans === 0 && data.unmappedBarcodes === 0 && (
          <div className="text-sm text-gray-500 text-center py-4">
            No scan data available for today
          </div>
        )}
      </div>
    </div>
  );
}






