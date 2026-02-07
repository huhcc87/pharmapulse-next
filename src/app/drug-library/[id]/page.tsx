'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import DrugQRDisplay from '@/components/DrugQRDisplay';

interface DrugDetails {
  id: number;
  brandName: string | null;
  manufacturer: string | null;
  priceInr: number | null;
  isDiscontinued: boolean | null;
  type: string | null;
  category: string | null;
  packSize: string | null;
  fullComposition: string | null;
  salts: string | null;
  qrCode: string | null;
  qrPayload: string | null;
}

export default function DrugDetailPage() {
  const params = useParams();
  const router = useRouter();

  const rawId = (params?.id as string) || '';

  const [drug, setDrug] = useState<DrugDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDrugDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const key = decodeURIComponent(rawId).trim();

      const isQr = /^INMED-\d{6}$/i.test(key) || key.toUpperCase().startsWith('INMED-');
      const isNumericId = /^\d+$/.test(key);

      let url = '';
      if (isQr) url = `/api/drug-library/by-qr?code=${encodeURIComponent(key)}`;
      else if (isNumericId) url = `/api/drug-library/by-id?id=${encodeURIComponent(key)}`;
      else url = `/api/drug-library/by-qr?code=${encodeURIComponent(key)}`; // safe fallback

      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        setDrug(null);
        setError(data?.error || 'Failed to fetch drug details');
        return;
      }

      if (!data?.drug) {
        setDrug(null);
        setError('Drug not found');
        return;
      }

      setDrug(data.drug);
    } catch (e) {
      console.error('Drug detail fetch error:', e);
      setDrug(null);
      setError('Failed to load drug details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (rawId) fetchDrugDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawId]);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        <span className="ml-3 text-gray-600">Loading drug details...</span>
      </div>
    );
  }

  if (error || !drug) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <p className="text-red-800">{error || 'Drug not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <button
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Drug Library
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {drug.brandName || `Drug #${drug.id}`}
            </h1>

            <div className="space-y-3 text-sm">
              {drug.manufacturer && (
                <div>
                  <span className="font-medium text-gray-600">Manufacturer:</span>
                  <span className="ml-2 text-gray-900">{drug.manufacturer}</span>
                </div>
              )}

              {drug.salts && (
                <div>
                  <span className="font-medium text-gray-600">Salts:</span>
                  <span className="ml-2 text-gray-900">{drug.salts}</span>
                </div>
              )}

              {drug.fullComposition && (
                <div>
                  <span className="font-medium text-gray-600">Full Composition:</span>
                  <span className="ml-2 text-gray-900">{drug.fullComposition}</span>
                </div>
              )}

              {drug.packSize && (
                <div>
                  <span className="font-medium text-gray-600">Pack Size:</span>
                  <span className="ml-2 text-gray-900">{drug.packSize}</span>
                </div>
              )}

              {drug.priceInr != null && (
                <div>
                  <span className="font-medium text-gray-600">Price:</span>
                  <span className="ml-2 font-semibold text-gray-900">
                    ₹{Number(drug.priceInr).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <DrugQRDisplay
            qrCode={drug.qrCode || ''}
            qrPayload={drug.qrPayload || ''}
            brandName={drug.brandName || `Drug #${drug.id}`}
          />
        </div>
      </div>
    </div>
  );
}





