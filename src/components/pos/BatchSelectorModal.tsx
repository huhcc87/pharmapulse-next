"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle, AlertTriangle } from "lucide-react";
import { getStockIcon, getExpiryIcon } from "@/lib/inventory/stock-indicators";
import { getExpiryWarning, getSuggestedDiscount } from "@/lib/inventory/fefo";

interface Batch {
  id: number;
  batchCode: string;
  expiryDate: string;
  daysToExpiry: number;
  quantityOnHand: number;
  isExpired: boolean;
  isNearExpiry: boolean;
  suggestedDiscount?: {
    discountPercent: number;
    reason: string;
  } | null;
}

interface BatchSelectorModalProps {
  isOpen: boolean;
  itemKey: string;
  productName: string;
  productId?: number;
  drugLibraryId?: number;
  requiredQty: number;
  currentBatchId?: number;
  batches: Batch[];
  onClose: () => void;
  onSelect: (batchId: number, discountPercent?: number) => void;
}

export default function BatchSelectorModal({
  isOpen,
  itemKey,
  productName,
  requiredQty,
  currentBatchId,
  batches,
  onClose,
  onSelect,
}: BatchSelectorModalProps) {
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(
    currentBatchId || null
  );
  const [selectedDiscount, setSelectedDiscount] = useState<number | null>(null);

  if (!isOpen) return null;

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);
  const canUseBatch = selectedBatch && selectedBatch.quantityOnHand >= requiredQty && !selectedBatch.isExpired;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">Select Batch - {productName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            Required quantity: <strong>{requiredQty}</strong>
          </div>

          {batches.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No batches available for this product
            </div>
          ) : (
            <div className="space-y-2">
              {batches.map((batch) => {
                const warning = getExpiryWarning(new Date(batch.expiryDate));
                const hasEnoughStock = batch.quantityOnHand >= requiredQty;
                const canSelect = hasEnoughStock && !batch.isExpired;
                const isSelected = selectedBatchId === batch.id;

                return (
                  <div
                    key={batch.id}
                    onClick={() => canSelect && setSelectedBatchId(batch.id)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : canSelect
                        ? "border-gray-200 hover:border-gray-300"
                        : "border-red-200 bg-red-50 opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium">{batch.batchCode}</span>
                          {getExpiryIcon(warning.level)}
                          {!hasEnoughStock && (
                            <span className="text-xs text-red-600">
                              (Insufficient: {batch.quantityOnHand} available)
                            </span>
                          )}
                          {batch.isExpired && (
                            <span className="text-xs text-red-600 font-semibold">EXPIRED</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>
                            <span className="font-medium">Stock:</span> {batch.quantityOnHand}{" "}
                            {getStockIcon(hasEnoughStock ? "IN_STOCK" : "LOW_STOCK")}
                          </div>
                          <div>
                            <span className="font-medium">Expiry:</span>{" "}
                            {new Date(batch.expiryDate).toLocaleDateString()} (
                            {batch.daysToExpiry > 0
                              ? `${batch.daysToExpiry} days`
                              : "Expired"}
                            )
                          </div>
                          {warning.level !== "SAFE" && (
                            <div className={`text-sm ${
                              warning.level === "EXPIRED"
                                ? "text-red-600"
                                : warning.level === "CRITICAL"
                                ? "text-red-600"
                                : "text-yellow-600"
                            }`}>
                              <AlertTriangle className="w-4 h-4 inline mr-1" />
                              {warning.message}
                            </div>
                          )}
                          {batch.suggestedDiscount && (
                            <div className="text-sm text-blue-600 mt-2">
                              <strong>Suggested discount:</strong> {batch.suggestedDiscount.discountPercent}% - {batch.suggestedDiscount.reason}
                            </div>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedBatch && canUseBatch && selectedBatch.suggestedDiscount && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedDiscount !== null}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedDiscount(selectedBatch.suggestedDiscount?.discountPercent || 0);
                    } else {
                      setSelectedDiscount(null);
                    }
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm">
                  Apply {selectedBatch.suggestedDiscount.discountPercent}% discount ({selectedBatch.suggestedDiscount.reason})
                </span>
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={() => {
                if (selectedBatchId && canUseBatch) {
                  onSelect(selectedBatchId, selectedDiscount || undefined);
                  onClose();
                }
              }}
              disabled={!selectedBatchId || !canUseBatch}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Select Batch
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
