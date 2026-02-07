/**
 * Scan Confirmation Component
 * 
 * Shows inline confirmation when a product is scanned and added to cart
 * Allows quick quantity adjustment or removal
 */

"use client";

import { useEffect, useState } from "react";
import { Check, X, Plus, Minus } from "lucide-react";

interface ScanConfirmationProps {
  productName: string;
  quantity: number;
  price: string;
  onAdjustQuantity: (newQty: number) => void;
  onRemove: () => void;
  onConfirm: () => void;
  autoHideMs?: number;
}

export default function ScanConfirmation({
  productName,
  quantity,
  price,
  onAdjustQuantity,
  onRemove,
  onConfirm,
  autoHideMs = 3000,
}: ScanConfirmationProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoHideMs > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        onConfirm();
      }, autoHideMs);
      return () => clearTimeout(timer);
    }
  }, [autoHideMs, onConfirm]);

  if (!visible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right">
      <div className="bg-green-50 border-2 border-green-500 rounded-lg shadow-lg p-4 min-w-[320px]">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <Check className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-900">Item Added</h4>
              <button
                onClick={() => {
                  setVisible(false);
                  onConfirm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-700 mb-1">{productName}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Qty:</span>
                <button
                  onClick={() => onAdjustQuantity(Math.max(1, quantity - 1))}
                  className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100"
                  disabled={quantity <= 1}
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-sm font-medium w-8 text-center">{quantity}</span>
                <button
                  onClick={() => onAdjustQuantity(quantity + 1)}
                  className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{price}</span>
                <button
                  onClick={() => {
                    onRemove();
                    setVisible(false);
                    onConfirm();
                  }}
                  className="text-xs text-red-600 hover:text-red-800 px-2 py-1 border border-red-300 rounded hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
