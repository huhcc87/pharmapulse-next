"use client";

import { useState } from "react";
import { X, CheckCircle, AlertCircle } from "lucide-react";

interface HsnIssue {
  itemKey: string;
  productName: string;
  productId?: number;
  drugLibraryId?: number;
  suggestion?: {
    hsnCode: string;
    gstRate: number;
    description: string;
    confidence: "HIGH" | "MEDIUM" | "LOW";
  } | null;
}

interface HsnQuickFixModalProps {
  isOpen: boolean;
  issues: HsnIssue[];
  onClose: () => void;
  onFixed: () => void;
}

export default function HsnQuickFixModal({
  isOpen,
  issues,
  onClose,
  onFixed,
}: HsnQuickFixModalProps) {
  const [fixes, setFixes] = useState<Map<string, { hsnCode: string; gstRate: number }>>(new Map());
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleFix = async () => {
    setIsSaving(true);
    try {
      await Promise.all(
        Array.from(fixes.entries()).map(async ([key, fix]) => {
          const issue = issues.find((i) => i.itemKey === key);
          if (!issue) return;

          await fetch("/api/hsn/set", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: issue.productId,
              drugLibraryId: issue.drugLibraryId,
              hsnCode: fix.hsnCode,
              gstRate: fix.gstRate,
            }),
          });
        })
      );

      onFixed();
      onClose();
    } catch (error) {
      console.error("Failed to fix HSN:", error);
      alert("Failed to save HSN codes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">Fix Missing HSN Codes</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {issues.map((issue) => {
            const currentFix = fixes.get(issue.itemKey);
            const suggestedHsn = issue.suggestion?.hsnCode || "";
            const suggestedGst = issue.suggestion?.gstRate || 12;

            return (
              <div key={issue.itemKey} className="border rounded-lg p-4">
                <div className="font-medium mb-2">{issue.productName}</div>
                <div className="space-y-3">
                  {issue.suggestion && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">Suggestion</span>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            issue.suggestion.confidence === "HIGH"
                              ? "bg-green-100 text-green-700"
                              : issue.suggestion.confidence === "MEDIUM"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {issue.suggestion.confidence} Confidence
                        </span>
                      </div>
                      <div className="text-sm text-blue-700">
                        HSN: {issue.suggestion.hsnCode} | GST: {issue.suggestion.gstRate}% |{" "}
                        {issue.suggestion.description}
                      </div>
                      <button
                        onClick={() => {
                          setFixes(
                            new Map(fixes.set(issue.itemKey, {
                              hsnCode: suggestedHsn,
                              gstRate: suggestedGst,
                            }))
                          );
                        }}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-700 underline"
                      >
                        Use Suggestion
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        HSN Code
                      </label>
                      <input
                        type="text"
                        value={currentFix?.hsnCode || ""}
                        onChange={(e) => {
                          const newFixes = new Map(fixes);
                          const existing = newFixes.get(issue.itemKey) || { hsnCode: "", gstRate: 12 };
                          newFixes.set(issue.itemKey, { ...existing, hsnCode: e.target.value });
                          setFixes(newFixes);
                        }}
                        placeholder={suggestedHsn || "Enter HSN code"}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        GST Rate (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentFix?.gstRate || ""}
                        onChange={(e) => {
                          const newFixes = new Map(fixes);
                          const existing = newFixes.get(issue.itemKey) || { hsnCode: "", gstRate: 12 };
                          newFixes.set(issue.itemKey, {
                            ...existing,
                            gstRate: parseFloat(e.target.value) || 0,
                          });
                          setFixes(newFixes);
                        }}
                        placeholder={String(suggestedGst)}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={handleFix}
              disabled={isSaving || fixes.size === 0}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              {isSaving ? "Saving..." : "Save All"}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
