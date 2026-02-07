// src/components/pos/CartItemGstDetails.tsx
// Component to display GST/HSN details for cart items

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { calculateGst, formatRupees, formatGstRate } from "@/lib/gst/taxCalculator";
import type { CartItem } from "@/hooks/useCart";

interface CartItemGstDetailsProps {
  item: CartItem;
}

export default function CartItemGstDetails({ item }: CartItemGstDetailsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate tax breakdown
  const taxCalc = calculateGst({
    pricePaise: item.unitPricePaise,
    gstRate: item.gstRate,
    gstType: item.gstType,
    quantity: item.quantity,
    discountPaise: item.discountPaise,
    discountPercent: item.discountPercent,
  });

  const lineTotal = item.unitPricePaise * item.quantity;
  const discount = item.discountPercent
    ? Math.round((lineTotal * item.discountPercent) / 100)
    : (item.discountPaise ?? 0);

  return (
    <div className="border-t border-gray-200 pt-2 mt-2">
      {/* GST Info Header */}
      <div className="flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-3">
          <span>
            <strong>HSN:</strong> {item.hsnCode}
          </span>
          <span>
            <strong>GST:</strong> {formatGstRate(item.gstRate)}
          </span>
          {item.ean && (
            <span>
              <strong>EAN:</strong> {item.ean}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
        >
          {isExpanded ? (
            <>
              Hide Tax <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              Tax Breakdown <ChevronDown className="w-3 h-3" />
            </>
          )}
        </button>
      </div>

      {/* Expanded Tax Breakdown */}
      {isExpanded && (
        <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-600">Taxable Value:</span>
              <span className="ml-2 font-medium">{formatRupees(taxCalc.taxableValuePaise)}</span>
            </div>
            <div>
              <span className="text-gray-600">CGST ({item.gstRate / 2}%):</span>
              <span className="ml-2 font-medium">{formatRupees(taxCalc.cgstPaise)}</span>
            </div>
            <div>
              <span className="text-gray-600">SGST ({item.gstRate / 2}%):</span>
              <span className="ml-2 font-medium">{formatRupees(taxCalc.sgstPaise)}</span>
            </div>
            <div>
              <span className="text-gray-600">Line Total:</span>
              <span className="ml-2 font-medium">{formatRupees(taxCalc.lineTotalPaise)}</span>
            </div>
          </div>
          {discount > 0 && (
            <div className="mt-1 text-green-600">
              Discount: -{formatRupees(discount)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


