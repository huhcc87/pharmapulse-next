// src/app/dashboard/page.tsx - Owner-ready Dashboard
"use client";

import { useEffect, useState } from "react";
import { KpiTiles } from "./_components/KpiTiles";
import { AlertsFeed } from "./_components/AlertsFeed";
import { ComplianceCard } from "./_components/ComplianceCard";
import { InventoryInsights } from "./_components/InventoryInsights";
import { PosBarcodeHealth } from "./_components/PosBarcodeHealth";
import NoGstinEmptyState from "@/components/gst/NoGstinEmptyState";
import { useActiveGstin } from "@/hooks/useActiveGstin";

type DashboardSummary = {
  kpis: {
    todaySales: number;
    invoices: {
      issuedToday: number;
      draft: number;
    };
    gst: {
      mtdLiability: number;
      cgst: number;
      sgst: number;
      igst: number;
    };
    inventory: {
      lowStock: number;
      nearExpiry30: number;
      expired: number;
    };
    pos: {
      scanSuccessToday: number;
      scanFailToday: number;
      unmappedBarcodes: number;
    };
  };
  alerts: Array<{
    id: string;
    severity: "info" | "warn" | "critical";
    title: string;
    detail: string;
    href: string;
  }>;
  compliance: {
    gstr1Status: "ok" | "due" | "overdue" | "unknown";
    gstr3bStatus: "ok" | "due" | "overdue" | "unknown";
    missingHsnCount: number;
    dpcoRiskCount: number;
    expiredSaleFlag: boolean;
    riskScore: number;
  };
  insights: {
    topMovingSkus: Array<{ name: string; qty: number }>;
    deadStockCount: number;
    expiryBuckets: {
      "0_30": number;
      "30_90": number;
      "90_plus": number;
    };
  };
};

export default function DashboardHome() {
  const { loading: gstinLoading, hasGstins } = useActiveGstin();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    async function fetchSummary() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/dashboard/summary", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to fetch dashboard summary");
        }
        const summary = await res.json();
        setData(summary);
      } catch (err: any) {
        console.error("Dashboard fetch error:", err);
        setError(err?.message ?? "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    fetchSummary();
    // Refresh every 60 seconds
    const interval = setInterval(fetchSummary, 60000);
    return () => clearInterval(interval);
  }, []);

  if (gstinLoading || loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <div className="space-y-6">
          <KpiTiles
            data={{
              todaySales: 0,
              invoices: { issuedToday: 0, draft: 0 },
              gst: { mtdLiability: 0 },
              inventory: { lowStock: 0, nearExpiry30: 0 },
              pos: { unmappedBarcodes: 0 },
            }}
            loading={true}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <ComplianceCard
              data={{
                gstr1Status: "unknown",
                gstr3bStatus: "unknown",
                missingHsnCount: 0,
                dpcoRiskCount: 0,
                expiredSaleFlag: false,
                riskScore: 0,
              }}
              loading={true}
            />
            <AlertsFeed alerts={[]} loading={true} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <InventoryInsights
              data={{
                topMovingSkus: [],
                deadStockCount: 0,
                expiryBuckets: { "0_30": 0, "30_90": 0, "90_plus": 0 },
              }}
              loading={true}
            />
            <PosBarcodeHealth
              data={{
                scanSuccessToday: 0,
                scanFailToday: 0,
                unmappedBarcodes: 0,
              }}
              loading={true}
            />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-red-800 font-medium">Error loading dashboard</div>
          <div className="text-red-600 text-sm mt-1">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <div className="text-center py-8 text-gray-500">No data available</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your pharmacy operations</p>
      </div>

      {/* KPI Tiles */}
      <KpiTiles data={data.kpis} />

      {/* Compliance & Alerts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ComplianceCard data={data.compliance} />
        <AlertsFeed alerts={data.alerts} />
      </div>

      {/* Inventory Insights & POS Health Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <InventoryInsights data={data.insights} />
        <PosBarcodeHealth data={data.kpis.pos} />
      </div>

      {!hasGstins && (
        <div className="pt-2">
          <NoGstinEmptyState />
        </div>
      )}
    </div>
  );
}
