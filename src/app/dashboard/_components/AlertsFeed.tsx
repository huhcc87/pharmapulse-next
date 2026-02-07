"use client";

import Link from "next/link";
import { getSeverityIcon, getSeverityColor } from "@/lib/dashboard/metrics";
import { AlertCircle, Info, AlertTriangle } from "lucide-react";

type Alert = {
  id: string;
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
  href: string;
};

type Props = {
  alerts: Alert[];
  loading?: boolean;
};

export function AlertsFeed({ alerts, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Action Required</h3>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const displayAlerts = alerts.slice(0, 6);

  const getIcon = (severity: Alert["severity"]) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case "warn":
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case "info":
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Action Required</h3>
        {alerts.length > 6 && (
          <Link
            href="/reports/alerts"
            className="text-sm text-blue-600 hover:underline"
          >
            View all
          </Link>
        )}
      </div>
      {displayAlerts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Info className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p>No alerts at this time</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayAlerts.map((alert) => (
            <Link
              key={alert.id}
              href={alert.href}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
            >
              <div className="mt-0.5">{getIcon(alert.severity)}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">{alert.title}</div>
                <div className="text-sm text-gray-600 mt-0.5">{alert.detail}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}






