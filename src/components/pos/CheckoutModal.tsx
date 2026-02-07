"use client";

import { useState, useEffect } from "react";
import { X, AlertTriangle, CheckCircle, FileText, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { CartItem } from "@/hooks/useCart";
import { formatRupees } from "@/lib/gst/taxCalculator";
import PaymentModal from "./PaymentModal";
import { validateCartForInvoice, normalizeLineItem, filterBlockingIssues, type ValidationIssue } from "@/lib/cart/validation";

interface CheckoutModalProps {
  isOpen: boolean;
  items: CartItem[];
  customerId?: number | null;
  onClose: () => void;
  onConfirm: (payments: any[], idempotencyKey: string) => Promise<void>;
}

export default function CheckoutModal({
  isOpen,
  items,
  customerId,
  onClose,
  onConfirm,
}: CheckoutModalProps) {
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [invoicePreview, setInvoicePreview] = useState<any>(null);

  useEffect(() => {
    if (isOpen && items.length > 0) {
      validateCart();
    }
  }, [isOpen, items.length, items]);

  async function validateCart() {
    setIsValidating(true);
    
    // Step 1: Client-side validation first (fast, no API call)
    const clientIssues = validateCartForInvoice(items);
    const blockingIssues = filterBlockingIssues(clientIssues);
    
    if (process.env.NODE_ENV === "development" && clientIssues.length > 0) {
      console.warn("Invoice validation issues:", clientIssues);
    }

    // If there are blocking issues, show them immediately without API call
    if (blockingIssues.length > 0) {
      setValidationResult({
        valid: false,
        issues: blockingIssues,
        warnings: clientIssues.filter(i => i.type === "MISSING_HSN"), // HSN missing is a warning
        lineCalculations: [],
        totals: {
          totalTaxablePaise: 0,
          totalCGSTPaise: 0,
          totalSGSTPaise: 0,
          totalIGSTPaise: 0,
          grandTotalPaise: 0,
          roundOffPaise: 0,
        },
        supplyType: "INTRA_STATE",
      });
      setIsValidating(false);
      return;
    }

    // Step 2: Server-side validation (for stock, HSN lookup, etc.)
    try {
      const res = await fetch("/api/pos/validate-cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineItems: items,
          customerId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Validation failed" }));
        console.error("Validation API error:", errorData);
        // Set validation result with error
        setValidationResult({
          valid: false,
          issues: [{ type: "ERROR", message: errorData.error || "Validation failed. Please try again." }],
          warnings: [],
          lineCalculations: [],
          totals: {
            totalTaxablePaise: 0,
            totalCGSTPaise: 0,
            totalSGSTPaise: 0,
            totalIGSTPaise: 0,
            grandTotalPaise: 0,
            roundOffPaise: 0,
          },
          supplyType: "INTRA_STATE",
        });
        setIsValidating(false);
        return;
      }

      const data = await res.json();
      
      // Merge client-side issues with server-side issues
      const allIssues = [...blockingIssues, ...(data.issues || [])];
      const allBlocking = filterBlockingIssues(allIssues);
      
      setValidationResult({
        ...data,
        valid: allBlocking.length === 0 && data.valid,
        issues: allBlocking,
        warnings: [...clientIssues.filter(i => i.type === "MISSING_HSN"), ...(data.warnings || [])],
      });

      // Step 3: Build invoice preview with normalized line items (null-safe)
      if (allBlocking.length === 0 && data.valid) {
        const safeLineItems = (data.lineCalculations || []).map((calc: any, idx: number) => {
          const item = items[idx];
          if (!item) {
            if (process.env.NODE_ENV === "development") {
              console.warn("Line missing GST - item at index", idx, "is null");
            }
            return null;
          }

          // Ensure calc exists and has required fields
          if (!calc || typeof calc !== 'object') {
            if (process.env.NODE_ENV === "development") {
              console.warn("Line missing GST - calc is null or invalid at index", idx, { item, calc });
            }
            return null;
          }

          // Normalize the line item first - ensure calc has gstRate before normalizing
          const itemWithCalc = {
            ...item,
            // Ensure calc.gstRate exists before normalizing
            gstRate: calc.gstRate != null && !isNaN(calc.gstRate) 
              ? calc.gstRate 
              : (item.gstRate != null && !isNaN(item.gstRate) ? item.gstRate : 12),
            ...calc,
          };
          
          const normalized = normalizeLineItem(itemWithCalc);
          if (!normalized || normalized.gstRate == null || isNaN(normalized.gstRate)) {
            if (process.env.NODE_ENV === "development") {
              console.warn("Line missing GST - normalization returned null or invalid gstRate", { item, calc, normalized });
            }
            return null;
          }

          // Merge normalized data with calculation results
          return {
            ...item,
            ...normalized,
            // Override with calculated values if available (with null checks)
            cgstPaise: (calc?.cgstPaise != null) ? calc.cgstPaise : 0,
            sgstPaise: (calc?.sgstPaise != null) ? calc.sgstPaise : 0,
            igstPaise: (calc?.igstPaise != null) ? calc.igstPaise : 0,
            lineTotalPaise: (calc?.lineTotalPaise != null) ? calc.lineTotalPaise : 0,
            taxableValuePaise: (calc?.taxableValuePaise != null) ? calc.taxableValuePaise : 0,
            // Ensure gstRate is always a number (from normalized, fallback to calc, then item, then default)
            gstRate: normalized.gstRate || (calc?.gstRate != null && !isNaN(calc.gstRate) ? calc.gstRate : (item.gstRate != null && !isNaN(item.gstRate) ? item.gstRate : 12)),
          };
        }).filter((item: any) => item !== null);
        
        setInvoicePreview({
          lineItems: safeLineItems,
          totals: data.totals || {
            totalTaxablePaise: 0,
            totalCGSTPaise: 0,
            totalSGSTPaise: 0,
            totalIGSTPaise: 0,
            grandTotalPaise: 0,
            roundOffPaise: 0,
          },
          supplyType: data.supplyType || "INTRA_STATE",
        });
      } else {
        // Clear preview if there are blocking issues
        setInvoicePreview(null);
      }
    } catch (error: any) {
      console.error("Validation error:", error);
      // Set validation result with error
      setValidationResult({
        valid: false,
        issues: [{ type: "ERROR", message: error?.message || "Validation failed. Please try again." }],
        warnings: [],
      });
    } finally {
      setIsValidating(false);
    }
  }

  if (!isOpen) return null;

  if (showPayment && invoicePreview) {
    return (
      <PaymentModal
        isOpen={true}
        totalPaise={invoicePreview.totals.grandTotalPaise}
        onClose={() => {
          setShowPayment(false);
          onClose();
        }}
        onConfirm={async (payments) => {
          const idempotencyKey = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
          await onConfirm(payments, idempotencyKey);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">Checkout - Invoice Preview</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {isValidating ? (
            <div className="text-center py-8">Validating cart...</div>
          ) : validationResult ? (
            <>
              {/* Issues */}
              {validationResult.issues && validationResult.issues.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <h3 className="font-semibold text-red-800">Issues Found</h3>
                  </div>
                  <ul className="space-y-2">
                    {validationResult.issues.map((issue: any, idx: number) => (
                      <li key={idx} className="text-sm text-red-700">
                        {issue.message}
                        {issue.suggestion && issue.suggestion.gstRate != null && (
                          <span className="ml-2 text-blue-600">
                            (Suggested HSN: {issue.suggestion.hsnCode || "N/A"} @ {issue.suggestion.gstRate}%)
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {validationResult.warnings && validationResult.warnings.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <h3 className="font-semibold text-yellow-800">Warnings</h3>
                  </div>
                  <ul className="space-y-1">
                    {validationResult.warnings.map((warning: any, idx: number) => (
                      <li key={idx} className="text-sm text-yellow-700">{warning.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Invoice Preview */}
              {validationResult.valid && invoicePreview && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold">Invoice Preview</h3>
                    <span className="text-sm text-gray-500">
                      ({(invoicePreview.supplyType || "INTRA_STATE") === "INTRA_STATE" ? "Intra-State" : "Inter-State"})
                    </span>
                  </div>

                  {/* Line Items */}
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium">Item</th>
                          <th className="px-4 py-2 text-right text-sm font-medium">Qty</th>
                          <th className="px-4 py-2 text-right text-sm font-medium">Price</th>
                          <th className="px-4 py-2 text-right text-sm font-medium">HSN</th>
                          <th className="px-4 py-2 text-right text-sm font-medium">GST</th>
                          <th className="px-4 py-2 text-right text-sm font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoicePreview.lineItems.map((item: any, idx: number) => {
                          if (!item) return null;
                          
                          // Null-safe access to gstRate - use normalized value
                          const gstRate = (item.gstRate != null && !isNaN(item.gstRate) && item.gstRate >= 0 && item.gstRate <= 100)
                            ? item.gstRate
                            : (item.gstRateBps != null ? item.gstRateBps / 100 : 12);
                          
                          // Null-safe access to all other fields
                          const productName = item.productName || "Unknown Product";
                          const quantity = item.quantity || 0;
                          const unitPricePaise = item.unitPricePaise || 0;
                          const hsnCode = item.hsnCode || item.validatedHsnCode || "-";
                          const cgstPaise = item.cgstPaise ?? 0;
                          const sgstPaise = item.sgstPaise ?? 0;
                          const igstPaise = item.igstPaise ?? 0;
                          const lineTotalPaise = item.lineTotalPaise ?? 0;
                          
                          return (
                            <tr key={idx} className="border-t">
                              <td className="px-4 py-2 text-sm">{productName}</td>
                              <td className="px-4 py-2 text-sm text-right">{quantity}</td>
                              <td className="px-4 py-2 text-sm text-right">
                                {formatRupees(unitPricePaise)}
                              </td>
                              <td className="px-4 py-2 text-sm text-right">{hsnCode}</td>
                              <td className="px-4 py-2 text-sm text-right">
                                {gstRate.toFixed(1)}%
                                {(invoicePreview.supplyType || "INTRA_STATE") === "INTRA_STATE" ? (
                                  <span className="text-xs text-gray-500">
                                    {" "}
                                    (CGST: {formatRupees(cgstPaise)}, SGST:{" "}
                                    {formatRupees(sgstPaise)})
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-500">
                                    {" "}
                                    (IGST: {formatRupees(igstPaise)})
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm text-right font-medium">
                                {formatRupees(lineTotalPaise)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="border rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Taxable Value:</span>
                      <span>{formatRupees(invoicePreview.totals.totalTaxablePaise)}</span>
                    </div>
                    {(invoicePreview.supplyType || "INTRA_STATE") === "INTRA_STATE" ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span>CGST:</span>
                          <span>{formatRupees(invoicePreview.totals.totalCGSTPaise)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>SGST:</span>
                          <span>{formatRupees(invoicePreview.totals.totalSGSTPaise)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-sm">
                        <span>IGST:</span>
                        <span>{formatRupees(invoicePreview.totals.totalIGSTPaise)}</span>
                      </div>
                    )}
                    {invoicePreview.totals.roundOffPaise !== 0 && (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Round Off:</span>
                        <span>{formatRupees(invoicePreview.totals.roundOffPaise)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Grand Total:</span>
                      <span>{formatRupees(invoicePreview.totals.grandTotalPaise)}</span>
                    </div>
                  </div>

                  {/* QR Code Preview */}
                  {invoicePreview.totals.grandTotalPaise > 0 && (
                    <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <QRCodeSVG
                          value={JSON.stringify({
                            type: "INVOICE_PREVIEW",
                            total: invoicePreview.totals.grandTotalPaise,
                          })}
                          size={150}
                        />
                        <p className="mt-2 text-xs text-gray-600">Invoice QR Code</p>
                      </div>
                    </div>
                  )}

                  {/* Proceed Button - Only enabled if no blocking issues */}
                  <button
                    onClick={() => setShowPayment(true)}
                    disabled={!validationResult.valid || (validationResult.issues && validationResult.issues.length > 0)}
                    className={`w-full px-6 py-3 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 ${
                      validationResult.valid && (!validationResult.issues || validationResult.issues.length === 0)
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    <CheckCircle className="w-5 h-5" />
                    Proceed to Payment
                  </button>
                </div>
              )}

              {!validationResult.valid && (
                <div className="text-center py-8">
                  {validationResult.issues && validationResult.issues.length > 0 ? (
                    <>
                      <p className="text-red-600 mb-4">Please fix the issues above before proceeding</p>
                      <button
                        onClick={onClose}
                        className="px-6 py-2 border rounded-lg hover:bg-gray-50"
                      >
                        Close
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-yellow-600 mb-4">
                        Validation in progress... If this persists, please refresh and try again.
                      </p>
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => validateCart()}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Retry Validation
                        </button>
                        <button
                          onClick={onClose}
                          className="px-6 py-2 border rounded-lg hover:bg-gray-50"
                        >
                          Close
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">Loading...</div>
          )}
        </div>
      </div>
    </div>
  );
}
