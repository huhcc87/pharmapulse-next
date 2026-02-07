"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import DrugQRDisplay from "@/components/DrugQRDisplay";

type DrugDetails = {
  id: number;
  brandName?: string | null;
  manufacturer?: string | null;
  priceInr?: number | null;
  isDiscontinued?: boolean | null;
  type?: string | null;
  category?: string | null;
  packSize?: string | null;
  fullComposition?: string | null;
  salts?: string | null;
  qrCode?: string | null;
  qrPayload?: string | null;
};

export default function DrugDetailPage() {
  const params = useParams();
  const router = useRouter();

  // /drug-library/[id] -> params.id can be "1" or "INMED-000001"
  const key = String((params as any)?.id ?? "").trim();

  const [drug, setDrug] = useState<DrugDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDrugDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setDrug(null);

      if (!key) {
        setError("Missing id");
        return;
      }

      const isQr = /^INMED-\d{6}$/i.test(key) || key.toUpperCase().startsWith("INMED-");
      const isNumericId = /^\d+$/.test(key);

      // IMPORTANT: by-qr currently errors for you, so fallback to by-id if needed
      const url = isQr
        ? `/api/drug-library/by-qr?code=${encodeURIComponent(key)}`
        : `/api/drug-library/by-id?id=${encodeURIComponent(key)}`;

      let res = await fetch(url);
      let data: any = null;

      try {
        data = await res.json();
      } catch {
        // non-json response
      }

      // If QR endpoint fails, fallback to by-id when possible
      if (isQr && (!res.ok || !data?.success)) {
        const numeric = key.replace(/^INMED-/i, "");
        if (/^\d{6}$/.test(numeric)) {
          const fallbackId = String(parseInt(numeric, 10)); // "000001" -> "1"
          res = await fetch(`/api/drug-library/by-id?id=${encodeURIComponent(fallbackId)}`);
          data = await res.json();
        }
      }

      if (!res.ok || !data?.success) {
        setError(data?.error || "Failed to fetch drug details");
        return;
      }

      if (!data.drug) {
        setError("Drug not found");
        return;
      }

      setDrug(data.drug);
    } catch (e) {
      console.error(e);
      setError("Failed to load drug details");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrugDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-3 text-gray-600">Loading drug details...</span>
      </div>
    );
  }

  if (error || !drug) {
    return (
      <div className="p-6">
        <button onClick={() => router.back()} className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <p className="text-red-800">{error || "Drug not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" />
        Back to Drug Library
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{drug.brandName || `Drug #${drug.id}`}</h1>

            <div className="space-y-3 text-sm">
              {drug.manufacturer ? (
                <div>
                  <span className="font-medium text-gray-600">Manufacturer:</span>{" "}
                  <span className="text-gray-900">{drug.manufacturer}</span>
                </div>
              ) : null}

              {drug.fullComposition ? (
                <div>
                  <span className="font-medium text-gray-600">Full Composition:</span>{" "}
                  <span className="text-gray-900">{drug.fullComposition}</span>
                </div>
              ) : null}

              {drug.salts ? (
                <div>
                  <span className="font-medium text-gray-600">Salts:</span>{" "}
                  <span className="text-gray-900">{drug.salts}</span>
                </div>
              ) : null}

              {drug.category ? (
                <div>
                  <span className="font-medium text-gray-600">Category:</span>{" "}
                  <span className="text-gray-900">{drug.category}</span>
                </div>
              ) : null}

              {typeof drug.priceInr === "number" ? (
                <div>
                  <span className="font-medium text-gray-600">Price:</span>{" "}
                  <span className="font-semibold text-gray-900">₹{drug.priceInr.toFixed(2)}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div>
          <DrugQRDisplay
            qrCode={drug.qrCode || `INMED-${String(drug.id).padStart(6, "0")}`}
            qrPayload={drug.qrPayload || ""}
            brandName={drug.brandName || `Drug #${drug.id}`}
          />
        </div>
      </div>
    </div>
  );
}
