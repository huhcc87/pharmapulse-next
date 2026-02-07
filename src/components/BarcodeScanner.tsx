'use client';

import { useEffect, useRef, useState } from 'react';
import { Scan, CheckCircle2, AlertCircle } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  placeholder?: string;
  className?: string;
}

export default function BarcodeScanner({ 
  onScan, 
  placeholder = 'Scan barcode or type manually...',
  className = '' 
}: BarcodeScannerProps) {
  const [barcode, setBarcode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Focus the input when scanner starts (first character)
      if (inputRef.current && !inputRef.current.matches(':focus')) {
        // If it's likely a scanner input (fast typing), focus the input
        const currentTime = Date.now();
        if (currentTime - lastKeyTimeRef.current < 50) {
          inputRef.current.focus();
        }
        lastKeyTimeRef.current = currentTime;
      }

      // Handle Enter key
      if (event.key === 'Enter' && inputRef.current === document.activeElement) {
        event.preventDefault();
        const scannedValue = barcode.trim();
        
        if (scannedValue.length > 0) {
          setIsScanning(true);
          setLastScanned(scannedValue);
          onScan(scannedValue);
          setBarcode('');
          
          setTimeout(() => {
            setIsScanning(false);
            if (inputRef.current) {
              inputRef.current.focus();
            }
          }, 1000);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [barcode, onScan]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBarcode(e.target.value);
  };

  const handleManualSubmit = () => {
    if (barcode.trim().length > 0) {
      setIsScanning(true);
      setLastScanned(barcode.trim());
      onScan(barcode.trim());
      setBarcode('');
      
      setTimeout(() => {
        setIsScanning(false);
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 1000);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Scan className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
          isScanning ? 'text-teal-500 animate-pulse' : 'text-gray-400'
        }`} />
        <input
          ref={inputRef}
          type="text"
          value={barcode}
          onChange={handleInputChange}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleManualSubmit();
            }
          }}
          placeholder={placeholder}
          className={`w-full pl-10 pr-24 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
            isScanning ? 'border-teal-500 bg-teal-50' : 'border-gray-300'
          }`}
          autoFocus
        />
        {isScanning && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <CheckCircle2 className="w-5 h-5 text-teal-500 animate-pulse" />
          </div>
        )}
        {lastScanned && !isScanning && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="text-xs text-gray-500">Scanned: {lastScanned}</div>
          </div>
        )}
      </div>
      {isScanning && (
        <div className="mt-2 flex items-center gap-2 text-sm text-teal-600">
          <Scan className="w-4 h-4 animate-pulse" />
          <span>Processing barcode...</span>
        </div>
      )}
    </div>
  );
}

