'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Package, Loader2, Plus, X } from 'lucide-react';

interface SearchResult {
  type: 'PACK' | 'BRAND' | 'FORMULATION' | 'MOLECULE';
  packId?: number;
  brandId?: number;
  formulationId?: number;
  moleculeId?: number;
  brand?: string;
  formulation?: string;
  composition?: string;
  packSize?: string;
  mrp?: number;
  gstRate?: number;
  hsn?: string;
  matchReason?: string;
  confidence?: number;
  score?: number;
}

interface DrugSearchComboboxProps {
  onSelect: (result: SearchResult) => void;
  placeholder?: string;
  tenantId?: number;
  className?: string;
  onBarcodeScan?: (barcode: string) => void;
}

export default function DrugSearchCombobox({
  onSelect,
  placeholder = 'Search by brand, generic, salt, strength, or barcode...',
  tenantId,
  className = '',
  onBarcodeScan,
}: DrugSearchComboboxProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          limit: '10',
        });
        if (tenantId) {
          params.append('tenantId', tenantId.toString());
        }

        const response = await fetch(`/api/drug-library/search?${params}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data);
          setIsOpen(data.length > 0);
          setSelectedIndex(-1);
        }
      } catch (error) {
        console.error('Error searching drugs:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [query, tenantId]);

  // Handle barcode paste (fast input detection)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const pastedText = e.clipboardData?.getData('text') || '';
      // If pasted text looks like a barcode (long numeric string)
      if (pastedText.length >= 8 && /^\d+$/.test(pastedText)) {
        if (onBarcodeScan) {
          onBarcodeScan(pastedText);
        }
        setQuery(pastedText);
      }
    };

    const input = inputRef.current;
    if (input) {
      input.addEventListener('paste', handlePaste);
      return () => input.removeEventListener('paste', handlePaste);
    }
  }, [onBarcodeScan]);

  const handleSelect = (result: SearchResult) => {
    onSelect(result);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        } else if (results.length > 0) {
          handleSelect(results[0]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        if (inputRef.current) {
          inputRef.current.blur();
        }
        break;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'PACK': return 'Pack';
      case 'BRAND': return 'Brand';
      case 'FORMULATION': return 'Formulation';
      case 'MOLECULE': return 'Molecule';
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PACK': return 'bg-blue-100 text-blue-700';
      case 'BRAND': return 'bg-green-100 text-green-700';
      case 'FORMULATION': return 'bg-purple-100 text-purple-700';
      case 'MOLECULE': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onBlur={() => {
            // Delay to allow click events
            setTimeout(() => setIsOpen(false), 200);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 animate-spin text-gray-400" />
        )}
        {query && !isLoading && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto"
        >
          {results.map((result, index) => (
            <button
              key={`${result.type}-${result.packId || result.brandId || result.formulationId || result.moleculeId}-${index}`}
              onClick={() => handleSelect(result)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                selectedIndex === index ? 'bg-teal-50 border-teal-200' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {result.brand && (
                      <span className="font-semibold text-gray-900 truncate">{result.brand}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getTypeColor(result.type)}`}>
                      {getTypeLabel(result.type)}
                    </span>
                  </div>
                  {result.formulation && (
                    <div className="text-sm text-gray-600 mb-1">{result.formulation}</div>
                  )}
                  {result.composition && (
                    <div className="text-xs text-gray-500 mb-1">
                      <span className="font-medium">Composition:</span> {result.composition}
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {result.packSize && <span>Pack: {result.packSize}</span>}
                    {result.mrp && <span>MRP: ₹{result.mrp.toFixed(2)}</span>}
                    {result.gstRate && <span>GST: {result.gstRate}%</span>}
                    {result.hsn && <span>HSN: {result.hsn}</span>}
                  </div>
                  {result.matchReason && (
                    <div className="text-xs text-teal-600 mt-1">{result.matchReason}</div>
                  )}
                </div>
                <Package className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}

      {query && !isLoading && results.length === 0 && isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
          <div className="text-center text-gray-500">
            <p className="mb-2">No results found for "{query}"</p>
            <button
              onClick={() => {
                // Open add alias/mapping modal (to be implemented)
                console.log('Add alias/mapping for:', query);
              }}
              className="text-sm text-teal-600 hover:text-teal-700 flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>Not found? Add alias/mapping</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

