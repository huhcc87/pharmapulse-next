"use client";

import { useState } from "react";
import { CreditCard, Upload, Check, X } from "lucide-react";
import { showToast } from "@/lib/toast";

interface InsuranceCardCaptureProps {
  onCapture: (cardData: InsuranceCardData) => void;
  onCancel?: () => void;
}

export interface InsuranceCardData {
  memberId: string;
  policyNumber: string;
  policyHolderName: string;
  insuranceProvider: string;
  expiryDate?: string;
  cardImageUrl?: string;
}

export default function InsuranceCardCapture({
  onCapture,
  onCancel,
}: InsuranceCardCaptureProps) {
  const [cardData, setCardData] = useState<InsuranceCardData>({
    memberId: "",
    policyNumber: "",
    policyHolderName: "",
    insuranceProvider: "",
    expiryDate: "",
  });

  const [isUploading, setIsUploading] = useState(false);
  const [eligibilityStatus, setEligibilityStatus] = useState<{
    isEligible: boolean;
    message?: string;
  } | null>(null);

  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/insurance/upload-card", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload card image");
      }

      const data = await response.json();
      setCardData((prev) => ({ ...prev, cardImageUrl: data.imageUrl }));

      // TODO: OCR extraction of card details
      showToast("Card image uploaded successfully", "success");
    } catch (error: any) {
      showToast(error?.message || "Failed to upload card", "error");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCheckEligibility() {
    if (!cardData.memberId || !cardData.policyNumber) {
      showToast("Please enter member ID and policy number", "error");
      return;
    }

    setIsCheckingEligibility(true);

    try {
      const response = await fetch("/api/insurance/check-eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: cardData.memberId,
          policyNumber: cardData.policyNumber,
          provider: cardData.insuranceProvider,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to check eligibility");
      }

      const data = await response.json();

      setEligibilityStatus({
        isEligible: !!data.isEligible,
        message: data.message,
      });

      if (data.isEligible) {
        showToast("Insurance eligibility confirmed", "success");
      } else {
        // ✅ FIX: showToast does not support "warning" in your typings
        // Map warning-like messages to "info"
        showToast(data.message || "Insurance not eligible", "info");
      }
    } catch (error: any) {
      showToast(error?.message || "Failed to check eligibility", "error");
    } finally {
      setIsCheckingEligibility(false);
    }
  }

  function handleSubmit() {
    if (!cardData.memberId || !cardData.policyNumber) {
      showToast("Please enter required fields", "error");
      return;
    }

    onCapture(cardData);
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Insurance Card
        </h3>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Upload Card Image */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload Insurance Card
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
            id="insurance-card-upload"
          />
          <label
            htmlFor="insurance-card-upload"
            className="cursor-pointer flex flex-col items-center gap-2"
          >
            <Upload className="w-8 h-8 text-gray-400" />
            <span className="text-sm text-gray-600">
              {isUploading ? "Uploading..." : "Click to upload card image"}
            </span>
          </label>
        </div>
      </div>

      {/* Card Details Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Insurance Provider
          </label>
          <select
            value={cardData.insuranceProvider}
            onChange={(e) =>
              setCardData((prev) => ({
                ...prev,
                insuranceProvider: e.target.value,
              }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Select provider</option>
            <option value="STAR_HEALTH">Star Health</option>
            <option value="HDFC_ERGO">HDFC Ergo</option>
            <option value="ICICI_LOMBARD">ICICI Lombard</option>
            <option value="BAJAJ_ALLIANZ">Bajaj Allianz</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Member ID *
          </label>
          <input
            type="text"
            value={cardData.memberId}
            onChange={(e) =>
              setCardData((prev) => ({ ...prev, memberId: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Enter member ID"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Policy Number *
          </label>
          <input
            type="text"
            value={cardData.policyNumber}
            onChange={(e) =>
              setCardData((prev) => ({
                ...prev,
                policyNumber: e.target.value,
              }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Enter policy number"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Policy Holder Name
          </label>
          <input
            type="text"
            value={cardData.policyHolderName}
            onChange={(e) =>
              setCardData((prev) => ({
                ...prev,
                policyHolderName: e.target.value,
              }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Enter policy holder name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expiry Date
          </label>
          <input
            type="date"
            value={cardData.expiryDate}
            onChange={(e) =>
              setCardData((prev) => ({ ...prev, expiryDate: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      {/* Eligibility Check */}
      {eligibilityStatus && (
        <div
          className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
            eligibilityStatus.isEligible
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {eligibilityStatus.isEligible ? (
            <Check className="w-5 h-5" />
          ) : (
            <X className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">
            {eligibilityStatus.message ||
              (eligibilityStatus.isEligible ? "Eligible" : "Not eligible")}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={handleCheckEligibility}
          disabled={isCheckingEligibility}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isCheckingEligibility ? "Checking..." : "Check Eligibility"}
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Use Insurance
        </button>
      </div>
    </div>
  );
}
