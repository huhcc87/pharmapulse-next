"use client";

import { formatCurrency } from "@/lib/dashboard/metrics";
import { TrendingUp, FileText, Receipt, Package, AlertTriangle, Barcode } from "lucide-react";

type KpiData = {
  todaySales: number;
  invoices: {
    issuedToday: number;
    draft: number;
  };
  gst: {
    mtdLiability: number;
  };
  inventory: {
    lowStock: number;
    nearExpiry30: number;
  };
  pos: {
    unmappedBarcodes: number;
  };
};

type Props = {
  data: KpiData;
  loading?: boolean;
};

export function KpiTiles({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-white p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  const tiles = [
    {
      title: "Today's Sales",
      value: formatCurrency(data.todaySales),
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Invoices",
      value: `${data.invoices.issuedToday} / ${data.invoices.draft}`,
      subtitle: "Issued / Draft",
      icon: FileText,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "GST MTD",
      value: formatCurrency(data.gst.mtdLiability),
      icon: Receipt,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Low Stock",
      value: data.inventory.lowStock.toString(),
      icon: Package,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Near Expiry",
      value: data.inventory.nearExpiry30.toString(),
      subtitle: "0-30 days",
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Unmapped",
      value: data.pos.unmappedBarcodes.toString(),
      subtitle: "Barcodes",
      icon: Barcode,
      color: "text-gray-600",
      bgColor: "bg-gray-50",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {tiles.map((tile, idx) => {
        const Icon = tile.icon;
        return (
          <div key={idx} className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">{tile.title}</span>
              <div className={`p-2 rounded ${tile.bgColor}`}>
                <Icon className={`w-4 h-4 ${tile.color}`} />
              </div>
            </div>
            <div className="text-2xl font-semibold text-gray-900">{tile.value}</div>
            {tile.subtitle && <div className="text-xs text-gray-500 mt-1">{tile.subtitle}</div>}
          </div>
        );
      })}
    </div>
  );
}






