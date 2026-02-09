'use client';

import { useState, useEffect } from 'react';
import { X, Package, AlertTriangle, Search, RefreshCw, CheckCircle2 } from 'lucide-react';
import AIProductLookup from './AIProductLookup';
import DrugSearchCombobox from './DrugSearchCombobox';
import { getGstRateFromHsn, validateHsnCode } from '@/lib/gst/hsnGstMapping';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: {
    productName: string;
    sku: string;
    barcode: string;
    category: string;
    stockLevel: number;
    unitPrice: number;
    mrp: number;
    minStock: number;
    manufacturer?: string;
    composition?: string;
    saltComposition?: string;
    hsnCode?: string;
    gstRate?: number;
    gstType?: string;
    schedule?: string;
    description?: string;
  }) => void;
  scannedBarcode?: string;
}

type GstAutofillSource = 'HSN_MAPPING' | 'MANUAL' | null;

type FormData = {
  productName: string;
  sku: string;
  barcode: string;
  category: string;
  stockLevel: number;
  unitPrice: number;
  mrp: number;
  minStock: number;
  manufacturer: string;
  composition: string;
  saltComposition: string;
  hsnCode: string;
  gstRate: number;
  gstType: string;
  schedule: string;
  description: string;
};

export default function AddProductModal({ isOpen, onClose, onAdd, scannedBarcode = '' }: AddProductModalProps) {
  const getEmptyForm = (barcode: string): FormData => ({
    productName: '',
    sku: '',
    barcode: barcode || '',
    category: 'General',
    stockLevel: 0,
    unitPrice: 0,
    mrp: 0,
    minStock: 0,
    manufacturer: '',
    composition: '',
    saltComposition: '',
    hsnCode: '',
    gstRate: 12,
    gstType: 'EXCLUSIVE',
    schedule: '',
    description: '',
  });

  const [formData, setFormData] = useState<FormData>(() => getEmptyForm(scannedBarcode));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // HSN → GST Auto-mapping state
  const [gstAutofillSource, setGstAutofillSource] = useState<GstAutofillSource>(null);
  const [hsnPrefixUsed, setHsnPrefixUsed] = useState<string | null>(null);
  const [gstMappingNote, setGstMappingNote] = useState<string | null>(null);
  const [isGstManuallyOverridden, setIsGstManuallyOverridden] = useState(false);

  useEffect(() => {
    if (scannedBarcode) {
      setFormData((prev) => {
        const updates: Partial<FormData> = { barcode: scannedBarcode };

        // Auto-generate SKU from barcode if empty
        if (!prev.sku) updates.sku = `PROD-${scannedBarcode.slice(-6)}`;

        // Clear any generic name - user must enter real name
        if (!prev.productName || prev.productName.startsWith('Medicine Product')) {
          updates.productName = '';
        }

        return { ...prev, ...updates };
      });
    }
  }, [scannedBarcode]);

  // HSN → GST Auto-mapping: Apply mapping when HSN code changes
  useEffect(() => {
    if (formData.hsnCode && formData.hsnCode.trim().length >= 2 && !isGstManuallyOverridden) {
      const mapping = getGstRateFromHsn(formData.hsnCode);

      if (mapping) {
        setFormData((prev) => ({
          ...prev,
          gstRate: mapping.gstRate,
          gstType: mapping.gstType,
          category:
            prev.category === 'General' && mapping.categorySuggestion ? mapping.categorySuggestion : prev.category,
        }));

        setGstAutofillSource('HSN_MAPPING');
        setHsnPrefixUsed(mapping.hsnPrefixUsed);
        setGstMappingNote(mapping.notes);
      } else {
        if (gstAutofillSource === 'HSN_MAPPING') {
          setGstAutofillSource(null);
          setHsnPrefixUsed(null);
          setGstMappingNote(null);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.hsnCode]);

  const reapplyHsnMapping = () => {
    if (!formData.hsnCode || formData.hsnCode.trim().length < 2) return;

    const mapping = getGstRateFromHsn(formData.hsnCode);

    if (mapping) {
      setFormData((prev) => ({
        ...prev,
        gstRate: mapping.gstRate,
        gstType: mapping.gstType,
        category:
          prev.category === 'General' && mapping.categorySuggestion ? mapping.categorySuggestion : prev.category,
      }));

      setGstAutofillSource('HSN_MAPPING');
      setHsnPrefixUsed(mapping.hsnPrefixUsed);
      setGstMappingNote(mapping.notes);
      setIsGstManuallyOverridden(false);
    }
  };

  // Enhanced: Handle AI/drug library fetched product details with complete auto-population
  const handleAIDetailsFetched = (details: any) => {
    const isValidName =
      details.name &&
      !details.name.toLowerCase().includes('product') &&
      !details.name.toLowerCase().includes('generic') &&
      !details.name.toLowerCase().includes('medicine product') &&
      !details.name.toLowerCase().includes('pharmaceutical product') &&
      details.name.length > 3;

    const isValidManufacturer =
      details.manufacturer &&
      !['To be determined', 'To be verified', 'Manufacturer details to be verified', 'N/A'].includes(details.manufacturer);

    const isValidDescription =
      details.description &&
      !details.description.toLowerCase().includes('to be verified') &&
      !details.description.toLowerCase().includes('details to be verified');

    const isValidCategory = details.category && details.category !== 'General';

    setFormData((prev) => ({
      ...prev,
      productName: isValidName ? details.name : prev.productName,
      category: isValidCategory ? details.category : prev.category || 'General',
      unitPrice: details.unitPrice || (details.mrp ? details.mrp * 0.9 : prev.unitPrice),
      mrp: details.mrp || prev.mrp,
      manufacturer: isValidManufacturer ? details.manufacturer : prev.manufacturer,
      composition:
        details.composition && details.composition !== 'Active ingredients as per formulation'
          ? details.composition
          : prev.composition,
      saltComposition: details.saltComposition || details.composition || prev.saltComposition,
      hsnCode: details.hsnCode || prev.hsnCode,
      gstRate: details.gstRate || details.gstPercent || prev.gstRate,
      schedule: details.schedule || prev.schedule,
      description: isValidDescription
        ? details.description
        : prev.description || `${prev.productName || details.name || 'Product'} - Pharmaceutical product`,
    }));
  };

  const categories = [
    'General',
    'Diabetes',
    'Antibiotic',
    'Allergy',
    'Cardiovascular',
    'Analgesics',
    'Antihistamines',
    'Vitamins & Supplements',
  ];

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.productName.trim()) newErrors.productName = 'Product name is required';
    if (!formData.barcode.trim()) newErrors.barcode = 'Barcode is required';
    if (!formData.sku.trim()) newErrors.sku = 'SKU is required';
    if (formData.unitPrice <= 0) newErrors.unitPrice = 'Unit price must be greater than 0';
    if (formData.mrp <= 0) newErrors.mrp = 'MRP must be greater than 0';
    if (formData.mrp < formData.unitPrice) newErrors.mrp = 'MRP should be greater than or equal to unit price';
    if (formData.stockLevel < 0) newErrors.stockLevel = 'Stock level cannot be negative';
    if (formData.minStock < 0) newErrors.minStock = 'Min stock cannot be negative';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.productName,
          sku: formData.sku,
          barcode: formData.barcode || null,
          category: formData.category,
          unitPrice: formData.unitPrice,
          mrp: formData.mrp || null,
          stockLevel: formData.stockLevel,
          minStock: formData.minStock,
          manufacturer: formData.manufacturer || null,
          composition: formData.composition || null,
          saltComposition: formData.saltComposition || null,
          hsnCode: formData.hsnCode || null,
          gstRate: formData.gstRate ? Number(formData.gstRate) : null,
          gstType: formData.gstType || 'EXCLUSIVE',
          schedule: formData.schedule || null,
          description: formData.description || null,
          gstAutofillSource: gstAutofillSource || 'MANUAL',
          hsnPrefixUsed: hsnPrefixUsed || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create product');
      }

      const newProduct = await response.json();
      onAdd(newProduct);

      // Reset form (✅ includes gstRate + gstType)
      setFormData(getEmptyForm(scannedBarcode));
      setErrors({});

      // Reset mapping state
      setGstAutofillSource(null);
      setHsnPrefixUsed(null);
      setGstMappingNote(null);
      setIsGstManuallyOverridden(false);

      onClose();
    } catch (error: any) {
      console.error('Error creating product:', error);
      const errorMsg = document.createElement('div');
      errorMsg.className = 'fixed top-20 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      errorMsg.innerHTML = `✗ ${error.message || 'Failed to create product'}`;
      document.body.appendChild(errorMsg);
      setTimeout(() => errorMsg.remove(), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setFormData(getEmptyForm(scannedBarcode)); // ✅ includes gstRate + gstType
    setErrors({});
    setGstAutofillSource(null);
    setHsnPrefixUsed(null);
    setGstMappingNote(null);
    setIsGstManuallyOverridden(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Add New Product</h2>
              <p className="text-sm text-gray-500">Add product to inventory</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Drug Library Search */}
        <div className="px-6 pt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Search Drug Library</label>
          <DrugSearchCombobox
            onSelect={async (result) => {
              if (result.type === 'PACK' && result.packId) {
                try {
                  const drugResponse = await fetch(`/api/drug-library/by-id?id=${result.packId}`);
                  if (drugResponse.ok) {
                    const drugData = await drugResponse.json();
                    setFormData((prev) => ({
                      ...prev,
                      productName: result.brand || drugData.brandName || prev.productName,
                      category: drugData.category || 'General',
                      manufacturer: drugData.manufacturer || prev.manufacturer,
                      unitPrice: result.mrp ? result.mrp * 0.9 : prev.unitPrice,
                      mrp: result.mrp || (drugData.dpcoCeilingPriceInr ? Number(drugData.dpcoCeilingPriceInr) : prev.mrp),
                      composition: result.composition || drugData.fullComposition || drugData.salts || prev.composition,
                      saltComposition: result.composition || drugData.salts || drugData.fullComposition || prev.saltComposition,
                      hsnCode: result.hsn || '30049099',
                      gstRate: result.gstRate || (drugData.gstPercent ? Number(drugData.gstPercent) : 12),
                      schedule: drugData.schedule || prev.schedule,
                      description: `${result.brand || drugData.brandName || 'Product'} - ${
                        drugData.fullComposition || drugData.salts || result.composition || 'Pharmaceutical product'
                      }`,
                    }));
                    return;
                  }
                } catch (error) {
                  console.error('Error fetching drug details:', error);
                }

                setFormData((prev) => ({
                  ...prev,
                  productName: result.brand || prev.productName,
                  category: 'General',
                  unitPrice: result.mrp ? result.mrp * 0.9 : prev.unitPrice,
                  mrp: result.mrp || prev.mrp,
                  composition: result.composition || prev.composition,
                  saltComposition: result.composition || prev.saltComposition,
                  hsnCode: result.hsn || prev.hsnCode,
                  gstRate: result.gstRate || prev.gstRate,
                  description: result.formulation ? `${result.brand || 'Product'} - ${result.formulation}` : prev.description,
                }));
              } else if (result.brand) {
                setFormData((prev) => ({
                  ...prev,
                  productName: result.brand || prev.productName,
                  composition: result.composition || prev.composition,
                  saltComposition: result.composition || prev.saltComposition,
                  description: result.formulation ? `${result.brand} - ${result.formulation}` : prev.description,
                }));
              }
            }}
            placeholder="Search by brand, generic, salt, strength, or barcode..."
            className="mb-4"
            onBarcodeScan={(barcode) => setFormData((prev) => ({ ...prev, barcode }))}
          />
        </div>

        {/* AI Product Lookup */}
        {(scannedBarcode || formData.productName) && (
          <div className="px-6 pt-6">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-yellow-800">AI-suggested details are assistive only.</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Verify product name, HSN, schedule, and MRP from pack label and supplier invoice before saving.
                  </p>
                </div>
              </div>
            </div>

            <AIProductLookup
              barcode={scannedBarcode || undefined}
              productName={formData.productName || undefined}
              hsnCode={formData.hsnCode || undefined}
              onDetailsFetched={handleAIDetailsFetched}
              onError={(error) => console.log('AI Lookup Error:', error)}
            />
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Product Name */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Product Name <span className="text-red-500">*</span>
              </label>
              {scannedBarcode && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const { AIProductLookup: Lookup } = await import('@/lib/ai/productLookup');
                      const results = await Lookup.searchByName(formData.productName || scannedBarcode);
                      if (results.length > 0 && results[0].name) {
                        setFormData((prev) => ({ ...prev, productName: results[0].name }));
                      }
                    } catch (error) {
                      console.error('Error searching product name:', error);
                    }
                  }}
                  className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1"
                >
                  <Search className="w-3 h-3" />
                  Search Better Name
                </button>
              )}
            </div>

            <input
              type="text"
              value={formData.productName}
              onChange={(e) => setFormData((prev) => ({ ...prev, productName: e.target.value }))}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                errors.productName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder={scannedBarcode ? 'Enter product name from package (e.g., Raboserv-LP)' : 'e.g., Paracetamol 500mg'}
            />

            {errors.productName && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                {errors.productName}
              </p>
            )}
          </div>

          {/* Barcode + SKU */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Barcode <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData((prev) => ({ ...prev, barcode: e.target.value }))}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.barcode ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Scan or enter barcode"
                readOnly={!!scannedBarcode}
              />
              {errors.barcode && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {errors.barcode}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SKU <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.sku ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., PARA-500-001"
              />
              {errors.sku && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {errors.sku}
                </p>
              )}
            </div>
          </div>

          {/* Category + Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Initial Stock Level</label>
              <input
                type="number"
                value={formData.stockLevel}
                onChange={(e) => setFormData((prev) => ({ ...prev, stockLevel: parseInt(e.target.value, 10) || 0 }))}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.stockLevel ? 'border-red-500' : 'border-gray-300'
                }`}
                min="0"
              />
              {errors.stockLevel && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {errors.stockLevel}
                </p>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unit Price (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.unitPrice}
                onChange={(e) => setFormData((prev) => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.unitPrice ? 'border-red-500' : 'border-gray-300'
                }`}
                min="0"
                placeholder="0.00"
              />
              {errors.unitPrice && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {errors.unitPrice}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                MRP (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.mrp}
                onChange={(e) => setFormData((prev) => ({ ...prev, mrp: parseFloat(e.target.value) || 0 }))}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.mrp ? 'border-red-500' : 'border-gray-300'
                }`}
                min="0"
                placeholder="0.00"
              />
              {errors.mrp && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {errors.mrp}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Min Stock Level</label>
              <input
                type="number"
                value={formData.minStock}
                onChange={(e) => setFormData((prev) => ({ ...prev, minStock: parseInt(e.target.value, 10) || 0 }))}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.minStock ? 'border-red-500' : 'border-gray-300'
                }`}
                min="0"
              />
              {errors.minStock && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {errors.minStock}
                </p>
              )}
            </div>
          </div>

          {/* Additional Info */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Additional Information (Optional)</h3>

            <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4">
              <p className="text-xs text-blue-800">
                <strong>GST Compliance:</strong> HSN and GST should match the supplier invoice. Auto-suggestions are assistive only.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Manufacturer</label>
                <input
                  type="text"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData((prev) => ({ ...prev, manufacturer: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Manufacturer name"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">HSN Code</label>
                  {gstAutofillSource === 'HSN_MAPPING' && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      GST Auto-mapped
                    </span>
                  )}
                </div>

                <input
                  type="text"
                  value={formData.hsnCode}
                  onChange={(e) => {
                    const sanitized = e.target.value.replace(/\D/g, '');
                    setFormData((prev) => ({ ...prev, hsnCode: sanitized }));
                    setIsGstManuallyOverridden(false);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="e.g., 30049099"
                  maxLength={8}
                />

                <p className="text-xs text-gray-500 mt-1">4–8 digits recommended for GST invoices.</p>

                {formData.hsnCode ? (() => {
                  const validation = validateHsnCode(formData.hsnCode);
                  if (validation.warning) return <p className="text-xs text-orange-600 mt-1">⚠️ {validation.warning}</p>;
                  if (validation.suggestion) return <p className="text-xs text-gray-600 mt-1">💡 {validation.suggestion}</p>;
                  return null;
                })() : null}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">GST Rate (%)</label>
                  {gstAutofillSource === 'HSN_MAPPING' && (
                    <button
                      type="button"
                      onClick={reapplyHsnMapping}
                      className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Reapply
                    </button>
                  )}
                </div>

                <select
                  value={formData.gstRate}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, gstRate: Number(e.target.value) }));
                    if (gstAutofillSource === 'HSN_MAPPING') {
                      setIsGstManuallyOverridden(true);
                      setGstAutofillSource('MANUAL');
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                  <option value={28}>28%</option>
                </select>

                {gstMappingNote && gstAutofillSource === 'HSN_MAPPING' && (
                  <p className="text-xs text-blue-600 mt-1">ℹ️ {gstMappingNote}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">GST Type</label>
                <select
                  value={formData.gstType}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, gstType: e.target.value }));
                    if (gstAutofillSource === 'HSN_MAPPING') {
                      setIsGstManuallyOverridden(true);
                      setGstAutofillSource('MANUAL');
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="EXCLUSIVE">EXCLUSIVE (GST added on top)</option>
                  <option value="INCLUSIVE">INCLUSIVE (GST included in price)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Salt Composition <span className="text-gray-400 text-xs">(Active Salt)</span>
                </label>
                <input
                  type="text"
                  value={formData.saltComposition}
                  onChange={(e) => setFormData((prev) => ({ ...prev, saltComposition: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="e.g., Paracetamol 500mg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Composition</label>
                <input
                  type="text"
                  value={formData.composition}
                  onChange={(e) => setFormData((prev) => ({ ...prev, composition: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Full active ingredients"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Schedule</label>
                <select
                  value={formData.schedule}
                  onChange={(e) => setFormData((prev) => ({ ...prev, schedule: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select Schedule</option>
                  <option value="H">H (Homeopathic)</option>
                  <option value="H1">H1</option>
                  <option value="X">X (Prescription)</option>
                  <option value="X1">X1</option>
                  <option value="G">G (General)</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Product notes / description"
              />
            </div>
          </div>

          {/* Discount */}
          {formData.mrp > 0 && formData.unitPrice > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900">Discount:</span>
                <span className="text-lg font-bold text-blue-600">
                  ₹{(formData.mrp - formData.unitPrice).toFixed(2)} (
                  {(((formData.mrp - formData.unitPrice) / formData.mrp) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors flex items-center gap-2 disabled:opacity-50"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  Add Product
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
