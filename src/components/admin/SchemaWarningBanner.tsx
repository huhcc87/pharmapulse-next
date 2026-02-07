"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

/**
 * Dev-only admin banner that checks for schema mismatches
 * Shows warning if inventory_items.mrp column is missing
 */
export function SchemaWarningBanner() {
  const [warning, setWarning] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    // Check schema on mount
    fetch("/api/admin/schema-check")
      .then((res) => res.json())
      .then((data) => {
        if (!data.columnExists) {
          setWarning(data.message || "Schema mismatch detected");
          setIsVisible(true);
        }
      })
      .catch((err) => {
        console.debug("Schema check failed:", err);
        // Silently fail - don't show error
      });
  }, []);

  if (!isVisible || !warning) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-50 border-b border-yellow-200 shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                {warning}
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Run migration: <code className="bg-yellow-100 px-1 rounded">add_mrp_to_inventory_items.sql</code>
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="text-yellow-600 hover:text-yellow-800 transition-colors"
            aria-label="Dismiss warning"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
