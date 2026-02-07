"use client";

import Link from "next/link";
import { getRiskScoreColor, getRiskScoreLabel } from "@/lib/dashboard/metrics";
import { Shield, CheckCircle, XCircle, AlertCircle, ExternalLink } from "lucide-react";

type ComplianceData = {
  gstr1Status: "ok" | "due" | "overdue" | "unknown";
  gstr3bStatus: "ok" | "due" | "overdue" | "unknown";
  missingHsnCount: number;
  dpcoRiskCount: number;
  expiredSaleFlag: boolean;
  riskScore: number;
};

type Props = {
  data: ComplianceData;
  loading?: boolean;
};

export function ComplianceCard({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-lg border bg-white p-4">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4 animate-pulse"></div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: ComplianceData["gstr1Status"]) => {
    switch (status) {
      case "ok":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "due":
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case "overdue":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: ComplianceData["gstr1Status"]) => {
    switch (status) {
      case "ok":
        return "Up to date";
      case "due":
        return "Due";
      case "overdue":
        return "Overdue";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-gray-600" />
          Compliance & Risk
        </h3>
        <Link
          href="/gst"
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          View GST <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-4">
        {/* Risk Score */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Risk Score</span>
            <span
              className={`px-2 py-1 rounded-full text-xs font-semibold border ${getRiskScoreColor(
                data.riskScore
              )}`}
            >
              {data.riskScore} - {getRiskScoreLabel(data.riskScore)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                data.riskScore < 30
                  ? "bg-green-500"
                  : data.riskScore < 60
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${Math.min(data.riskScore, 100)}%` }}
            />
          </div>
        </div>

        {/* GST Returns Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {getStatusIcon(data.gstr1Status)}
              <span>GSTR-1</span>
            </div>
            <span className="text-gray-600">{getStatusLabel(data.gstr1Status)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {getStatusIcon(data.gstr3bStatus)}
              <span>GSTR-3B</span>
            </div>
            <span className="text-gray-600">{getStatusLabel(data.gstr3bStatus)}</span>
          </div>
        </div>

        {/* Compliance Issues */}
        <div className="pt-2 border-t space-y-2">
          {data.missingHsnCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Missing HSN Codes</span>
              <span className="font-semibold text-orange-600">{data.missingHsnCount}</span>
            </div>
          )}
          {data.dpcoRiskCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">DPCO Price Risks</span>
              <span className="font-semibold text-yellow-600">{data.dpcoRiskCount}</span>
            </div>
          )}
          {data.expiredSaleFlag && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Expired Item Sales</span>
              <span className="font-semibold text-red-600">⚠️ Detected</span>
            </div>
          )}
          {data.missingHsnCount === 0 && data.dpcoRiskCount === 0 && !data.expiredSaleFlag && (
            <div className="text-sm text-gray-500 text-center py-2">
              No compliance issues detected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}






