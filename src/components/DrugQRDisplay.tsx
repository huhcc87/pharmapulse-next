'use client';

import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import QRCode from 'react-qr-code';

interface DrugQRDisplayProps {
  qrCode: string;
  qrPayload: string;
  brandName: string;
}

export default function DrugQRDisplay({ qrCode, qrPayload, brandName }: DrugQRDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 bg-white rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">QR Code</h3>
      
      <div className="flex flex-col items-center gap-4">
        <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
          <QRCode
            value={qrPayload}
            size={200}
            level="H"
            style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
            viewBox="0 0 200 200"
          />
        </div>
        
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            QR Code
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={qrCode}
              readOnly
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono"
            />
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
        
        <p className="text-xs text-gray-500 text-center">
          Scan this QR code to quickly add <strong>{brandName}</strong> to inventory
        </p>
      </div>
    </div>
  );
}

