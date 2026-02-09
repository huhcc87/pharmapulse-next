// src/components/pos/UpdateGstModal.tsx
// Modal to update product GST metadata from POS

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Save, Search, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Allow Prisma Decimal-like values without importing Prisma types here
type DecimalLike =
  | { toNumber: () => number }
  | { toString: () => string };

type GstRateValue = number | string | DecimalLike | null | undefined;

interface HSNOption {
  id: string;
  hsnCode: string;
  description: string;
  gstRate: GstRateValue; // ✅ FIX: allow Decimal-like types
  gstType: string;
  isActive: boolean;
}

interface UpdateGstModalProps {
  isOpen: boolean;
  product: {
    id: number;
    name: string;
    hsnCode?: string | null;
    gstRate?: number | null;
    gstType?: string | null;
    barcode?: string | null;
  } | null;
  onClose: () => void;
  onSuccess: (updatedProduct: any) => void;
}

// ✅ Centralized normalization: always returns a usable number
function normalizeGstRateToNumber(value: GstRateValue, fallback = 12): number {
  if (value == null) return fallback;

  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;

  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  }

  // Decimal-like
  if (typeof value === "object") {
    if ("toNumber" in value && typeof value.toNumber === "function") {
      const n = value.toNumber();
      return Number.isFinite(n) ? n : fallback;
    }
    if ("toString" in value && typeof value.toString === "function") {
      const n = parseFloat(value.toString());
      return Number.isFinite(n) ? n : fallback;
    }
  }

  return fallback;
}

export default function UpdateGstModal({
  isOpen,
  product,
  onClose,
  onSuccess,
}: UpdateGstModalProps) {
  const [formData, setFormData] = useState({
    hsnCode: "",
    gstRate: "12",
    gstType: "EXCLUSIVE",
    barcode: "",
    gstOverride: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hsnOptions, setHsnOptions] = useState<HSNOption[]>([]);
  const [isLoadingHsn, setIsLoadingHsn] = useState(false);
  const [selectedHsn, setSelectedHsn] = useState<HSNOption | null>(null);

  // AI HSN suggestions
  const [aiSuggestions, setAiSuggestions] = useState<
    Array<{
      hsnCode: string;
      description: string;
      gstRate: number;
      gstType: string;
      confidence: number;
      rationale: string;
      source: "RULES" | "AI";
      priority: number;
    }>
  >([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Barcode lookup state
  const [lookupStatus, setLookupStatus] = useState<
    "idle" | "searching" | "found" | "not_found" | "error"
  >("idle");
  const [lookupAttempted, setLookupAttempted] = useState(false);
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const lookupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Load HSN options
  useEffect(() => {
    setIsLoadingHsn(true);
    fetch("/api/hsn")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.hsn) {
          // Normalize gstRate to number-like field (but keep original in gstRate for display if needed)
          const normalizedHsn: HSNOption[] = data.hsn.map((h: any) => ({
            ...h,
            gstRate: h.gstRate, // keep as-is (Decimal-like ok)
          }));
          setHsnOptions(normalizedHsn);
        }
      })
      .catch((err) => {
        console.error("Failed to load HSN options:", err);
      })
      .finally(() => {
        setIsLoadingHsn(false);
      });
  }, []);

  // Load HSN AI suggestions
  const loadHsnSuggestions = async () => {
    if (!product || !product.name) return;

    setIsLoadingSuggestions(true);
    try {
      const response = await fetch("/api/hsn/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: product.name,
          productId: product.id,
        }),
      });

      const data = await response.json();
      if (data.suggestions) {
        setAiSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error("Failed to load HSN suggestions:", error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Initialize form when product changes
  useEffect(() => {
    if (product) {
      setFormData({
        hsnCode: product.hsnCode || "",
        gstRate: product.gstRate?.toString() || "12",
        gstType: product.gstType || "EXCLUSIVE",
        barcode: product.barcode || "",
        gstOverride: false,
      });
      setError(null);
      setBarcodeError(null);
      setLookupStatus("idle");
      setLookupAttempted(false);
      setLookupResult(null);
      setAiSuggestions([]);

      // Find matching HSN option
      if (product.hsnCode && hsnOptions.length > 0) {
        const match = hsnOptions.find((h) => h.hsnCode === product.hsnCode);
        if (match) {
          setSelectedHsn(match);

          // Auto-fill GST from HSN if not overriding
          const gstRateNum = normalizeGstRateToNumber(match.gstRate, 12);
          const gstRateStr = String(gstRateNum);

          setFormData((prev) => ({
            ...prev,
            gstRate: gstRateStr,
            gstType: match.gstType || "EXCLUSIVE",
          }));
        }
      } else if (!product.hsnCode) {
        // If HSN missing, load AI suggestions
        loadHsnSuggestions();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, hsnOptions]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (lookupTimeoutRef.current) {
        clearTimeout(lookupTimeoutRef.current);
      }
    };
  }, []);

  // Barcode lookup function
  const handleBarcodeLookup = useCallback(async (barcodeValue: string) => {
    const trimmed = barcodeValue.trim();

    // Don't lookup if empty or too short
    if (!trimmed || trimmed.length < 8) {
      setLookupStatus("idle");
      setLookupAttempted(false);
      setBarcodeError(null);
      setLookupResult(null);
      return;
    }

    setLookupStatus("searching");
    setLookupAttempted(true);
    setBarcodeError(null);
    setLookupResult(null);

    try {
      const response = await fetch(
        `/api/products/lookup?barcode=${encodeURIComponent(trimmed)}`
      );
      const data = await response.json();

      if (data.found && data.product) {
        setLookupStatus("found");
        setLookupResult(data.product);
        setBarcodeError(null);
      } else {
        setLookupStatus("not_found");
        setLookupResult(null);
        setBarcodeError("No product found with this barcode");
      }
    } catch (error: any) {
      console.error("Barcode lookup error:", error);
      setLookupStatus("error");
      setBarcodeError(error.message || "Failed to lookup barcode");
      setLookupResult(null);
    }
  }, []);

  // Handle barcode input change with debounce for barcode-first mode
  const handleBarcodeChange = (value: string) => {
    setFormData((prev) => ({ ...prev, barcode: value }));

    // Clear previous timeout
    if (lookupTimeoutRef.current) {
      clearTimeout(lookupTimeoutRef.current);
    }

    // If empty, reset lookup state
    if (!value.trim()) {
      setLookupStatus("idle");
      setLookupAttempted(false);
      setBarcodeError(null);
      setLookupResult(null);
      return;
    }

    // Only auto-lookup if length >= 8 (EAN-8/EAN-13 minimum)
    if (value.trim().length >= 8) {
      // Debounce: wait 500ms before lookup (good for barcode scanners)
      lookupTimeoutRef.current = setTimeout(() => {
        handleBarcodeLookup(value);
      }, 500);
    } else {
      // Too short, stay idle
      setLookupStatus("idle");
      setLookupAttempted(false);
      setBarcodeError(null);
    }
  };

  // Handle explicit lookup (Enter key or Lookup button)
  const handleExplicitLookup = () => {
    if (lookupTimeoutRef.current) {
      clearTimeout(lookupTimeoutRef.current);
    }
    handleBarcodeLookup(formData.barcode);
  };

  // Handle HSN selection - auto-fill GST
  const handleHsnSelect = (hsnCode: string) => {
    const match = hsnOptions.find((h) => h.hsnCode === hsnCode);
    if (match) {
      setSelectedHsn(match);

      if (!formData.gstOverride) {
        const gstRateNum = normalizeGstRateToNumber(match.gstRate, 12);
        const gstRateStr = String(gstRateNum);

        setFormData((prev) => ({
          ...prev,
          hsnCode,
          gstRate: gstRateStr,
          gstType: match.gstType || "EXCLUSIVE",
        }));
      } else {
        // Just update HSN code, keep manual GST values
        setFormData((prev) => ({ ...prev, hsnCode }));
      }
    } else {
      setSelectedHsn(null);
      setFormData((prev) => ({ ...prev, hsnCode }));
    }
  };

  if (!isOpen || !product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation: HSN is required
    if (!formData.hsnCode || !formData.hsnCode.trim()) {
      setError("HSN code is required");
      return;
    }

    // Validation: GST rate/type required if override enabled
    if (formData.gstOverride) {
      if (!formData.gstRate || !formData.gstType) {
        setError("GST rate and type are required when override is enabled");
        return;
      }
    }

    setIsSaving(true);

    try {
      // Normalize barcode: only send if provided, preserve leading zeros
      const barcodeToSave = formData.barcode.trim() || null;

      const res = await fetch(`/api/products/${product.id}/gst`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hsnCode: formData.hsnCode.trim(),
          gstRate: formData.gstOverride ? Number(formData.gstRate) : undefined,
          gstType: formData.gstOverride ? formData.gstType : undefined,
          barcode: barcodeToSave,
          gstOverride: formData.gstOverride,
        }),
      });

      const data = await res.json();

      if (data.ok && data.product) {
        // Show success toast
        const toast = document.createElement("div");
        toast.className =
          "fixed top-20 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50";
        toast.textContent = "✓ GST/HSN updated successfully!";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);

        // Call success callback
        onSuccess(data.product);
        onClose();
      } else {
        setError(data.error || "Failed to update GST details");
      }
    } catch (error: any) {
      console.error("Update GST error:", error);
      setError(error.message || "Failed to update GST details");
    } finally {
      setIsSaving(false);
    }
  };

  // Save button enabled logic
  const isSaveEnabled =
    !isSaving &&
    formData.hsnCode.trim().length >= 4 &&
    (!formData.gstOverride || (formData.gstRate && formData.gstType)) &&
    lookupStatus !== "searching"; // Don't block save during lookup, but wait if actively searching

  // For display: selected HSN GST rate as number
  const selectedHsnRate = selectedHsn ? normalizeGstRateToNumber(selectedHsn.gstRate, 12) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">Update GST Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isSaving}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Product Name (readonly) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Name
            </label>
            <input
              type="text"
              value={product.name}
              readOnly
              className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-600"
            />
          </div>

          {/* HSN Code (required) - Dropdown from HSNMaster */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                HSN Code <span className="text-red-500">*</span>
              </label>
              {!product?.hsnCode && aiSuggestions.length > 0 && (
                <button
                  type="button"
                  onClick={loadHsnSuggestions}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Refresh Suggestions
                </button>
              )}
            </div>

            {isLoadingHsn ? (
              <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500">
                Loading HSN codes...
              </div>
            ) : hsnOptions.length === 0 ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={formData.hsnCode}
                  onChange={(e) => {
                    const hsnCode = e.target.value.replace(/\D/g, "").slice(0, 8);
                    setFormData({ ...formData, hsnCode });
                  }}
                  placeholder="Enter HSN Code (4-8 digits)"
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  pattern="[0-9]{4,8}"
                  autoFocus
                />
                <p className="text-xs text-yellow-600">
                  ⚠️ No HSN codes in master. Enter manually or run:{" "}
                  <code className="bg-yellow-100 px-1 rounded">npm run seed:hsn</code>
                </p>
              </div>
            ) : (
              <select
                value={formData.hsnCode}
                onChange={(e) => handleHsnSelect(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              >
                <option value="">Select HSN Code</option>
                {hsnOptions.map((h) => {
                  const rateNum = normalizeGstRateToNumber(h.gstRate, 12);
                  return (
                    <option key={h.id} value={h.hsnCode}>
                      {h.hsnCode} - {h.description} ({rateNum}% {h.gstType})
                    </option>
                  );
                })}
              </select>
            )}

            <p className="text-xs text-gray-500 mt-1">
              {selectedHsn
                ? `Auto-filled: ${selectedHsnRate}% ${selectedHsn.gstType}`
                : "4-8 digits (e.g., 3004 for medicines)"}
            </p>

            {/* AI HSN Suggestions */}
            {!product?.hsnCode && aiSuggestions.length > 0 && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-900">
                    Suggested HSN Codes
                  </span>
                </div>
                <div className="space-y-2">
                  {aiSuggestions.slice(0, 3).map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          hsnCode: suggestion.hsnCode,
                          gstRate:
                            suggestion.gstRate != null
                              ? suggestion.gstRate.toString()
                              : "12",
                          gstType: suggestion.gstType || "EXCLUSIVE",
                        });
                        const match = hsnOptions.find((h) => h.hsnCode === suggestion.hsnCode);
                        if (match) setSelectedHsn(match);
                      }}
                      className={`w-full text-left p-2 rounded border-2 transition-colors ${
                        formData.hsnCode === suggestion.hsnCode
                          ? "border-blue-500 bg-blue-100"
                          : "border-gray-200 hover:border-blue-300 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-sm">
                            {suggestion.hsnCode} - {suggestion.gstRate}% {suggestion.gstType}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {suggestion.description}
                          </div>
                          {suggestion.rationale && (
                            <div className="text-xs text-gray-500 mt-1 italic">
                              {suggestion.rationale}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          {suggestion.source === "AI" && (
                            <Badge variant="outline" className="text-xs bg-yellow-100">
                              AI
                            </Badge>
                          )}
                          <span className="text-xs text-gray-500">
                            {(suggestion.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {aiSuggestions[0]?.source === "AI" && (
                  <p className="text-xs text-yellow-700 mt-2">
                    ⚠️ AI suggestion — verify before applying
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Admin Override Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="gstOverride"
              checked={formData.gstOverride}
              onChange={(e) => setFormData({ ...formData, gstOverride: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="gstOverride" className="text-sm text-gray-700">
              Override GST (admin only - manually set GST rate/type)
            </label>
          </div>

          {/* GST Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GST Rate (%) <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.gstRate}
              onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
              required
              disabled={!formData.gstOverride}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !formData.gstOverride ? "bg-gray-50 text-gray-600" : ""
              }`}
            >
              <option value="0">0%</option>
              <option value="5">5%</option>
              <option value="12">12%</option>
              <option value="18">18%</option>
              <option value="28">28%</option>
            </select>
            {!formData.gstOverride && (
              <p className="text-xs text-gray-500 mt-1">
                Auto-filled from HSN Master. Enable override to edit.
              </p>
            )}
          </div>

          {/* GST Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GST Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.gstType}
              onChange={(e) => setFormData({ ...formData, gstType: e.target.value })}
              required
              disabled={!formData.gstOverride}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !formData.gstOverride ? "bg-gray-50 text-gray-600" : ""
              }`}
            >
              <option value="EXCLUSIVE">EXCLUSIVE (GST added on top)</option>
              <option value="INCLUSIVE">INCLUSIVE (GST included in price)</option>
            </select>
            {!formData.gstOverride && (
              <p className="text-xs text-gray-500 mt-1">
                Auto-filled from HSN Master. Enable override to edit.
              </p>
            )}
            {formData.gstOverride && (
              <p className="text-xs text-gray-500 mt-1">
                {formData.gstType === "EXCLUSIVE"
                  ? "Price shown is before GST"
                  : "Price shown includes GST"}
              </p>
            )}
          </div>

          {/* EAN/Barcode (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              EAN/Barcode (Optional)
            </label>
            <div className="relative">
              <input
                ref={barcodeInputRef}
                type="text"
                value={formData.barcode}
                onChange={(e) => handleBarcodeChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && formData.barcode.trim().length >= 8) {
                    e.preventDefault();
                    handleExplicitLookup();
                  }
                }}
                placeholder="e.g., 8901030865579"
                className="w-full pl-3 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleExplicitLookup}
                disabled={
                  !formData.barcode.trim() ||
                  formData.barcode.trim().length < 8 ||
                  lookupStatus === "searching"
                }
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Lookup barcode"
              >
                {lookupStatus === "searching" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </button>
            </div>

            {lookupStatus === "idle" && !lookupAttempted && (
              <p className="text-xs text-gray-500 mt-1">
                Optional: Scan EAN/GTIN to attach barcode (minimum 8 characters)
              </p>
            )}

            {lookupStatus === "searching" && (
              <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Looking up barcode...
              </p>
            )}

            {lookupStatus === "found" && lookupResult && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    <strong>Matched:</strong> {lookupResult.name}
                    {lookupResult.hsnCode && ` (HSN: ${lookupResult.hsnCode})`}
                  </span>
                </div>
              </div>
            )}

            {lookupStatus === "not_found" && lookupAttempted && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>No product found with this barcode. You can still save the barcode.</span>
                </div>
              </div>
            )}

            {lookupStatus === "error" && barcodeError && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Lookup error: {barcodeError}</span>
                </div>
              </div>
            )}

            {lookupStatus === "idle" && lookupAttempted && !formData.barcode.trim() && (
              <p className="text-xs text-gray-500 mt-1">
                EAN-13, GTIN, or other barcode format
              </p>
            )}
          </div>

          {/* Main error message (not barcode-related) */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isSaveEnabled}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : lookupStatus === "searching" ? "Lookup in progress..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
