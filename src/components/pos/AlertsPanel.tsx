// src/components/pos/AlertsPanel.tsx
"use client";

import { AlertTriangle, Package, Clock } from "lucide-react";
import type { InventoryAlert, DrugInteractionAlert } from "@/lib/types/pos";

interface AlertsPanelProps {
  alerts: InventoryAlert[];
  interactionAlerts: DrugInteractionAlert[];
}

export default function AlertsPanel({ alerts, interactionAlerts }: AlertsPanelProps) {
  if (alerts.length === 0 && interactionAlerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {interactionAlerts.map((alert, idx) => (
        <div
          key={`interaction-${idx}`}
          className={`p-3 rounded-lg border-l-4 ${
            alert.severity === "ERROR"
              ? "bg-red-50 border-red-500 text-red-800"
              : "bg-yellow-50 border-yellow-500 text-yellow-800"
          }`}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium">Drug Interaction Warning</div>
              <div className="text-sm mt-1">{alert.message}</div>
              <div className="text-xs mt-1">
                Interacting drugs: {alert.interactingDrugs.join(", ")}
              </div>
            </div>
          </div>
        </div>
      ))}

      {alerts.map((alert, idx) => (
        <div
          key={`alert-${idx}`}
          className={`p-3 rounded-lg border-l-4 ${
            alert.severity === "ERROR"
              ? "bg-red-50 border-red-500 text-red-800"
              : "bg-yellow-50 border-yellow-500 text-yellow-800"
          }`}
        >
          <div className="flex items-start gap-2">
            {alert.type === "NEAR_EXPIRY" || alert.type === "EXPIRED" ? (
              <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <Package className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="font-medium">{alert.message}</div>
              {alert.daysUntilExpiry !== undefined && (
                <div className="text-xs mt-1">
                  Expires in {alert.daysUntilExpiry} days
                </div>
              )}
              {alert.currentStock !== undefined && (
                <div className="text-xs mt-1">
                  Stock: {alert.currentStock} (Reorder: {alert.reorderLevel})
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


