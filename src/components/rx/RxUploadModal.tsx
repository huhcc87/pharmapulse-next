"use client";

import { useState, useRef } from "react";
import { Upload, X, FileText, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CartBuilderModal from "./CartBuilderModal";

interface ParsedLine {
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  frequency?: string;
  duration?: string;
  quantity?: number;
  instructions?: string;
  confidence: number;
}

interface RxUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCartBuilt: (items: any[]) => void;
}

export default function RxUploadModal({
  isOpen,
  onClose,
  onCartBuilt,
}: RxUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [parsed, setParsed] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCartBuilder, setShowCartBuilder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setParsed(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/rx/parse", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setParsed(data.parsed);

      if (data.needsReview) {
        setError("Low confidence parsing detected. Please review and confirm each medication.");
      }

      // Auto-open cart builder if parsing successful
      if (data.parsed && data.parsed.lines && data.parsed.lines.length > 0) {
        setShowCartBuilder(true);
      }
    } catch (error: any) {
      console.error("Rx upload error:", error);
      setError(error.message || "Failed to parse prescription");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCartBuilt = (mappedItems: any[]) => {
    onCartBuilt(mappedItems);
    setShowCartBuilder(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex items-center justify-between border-b">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Upload Prescription (Rx OCR)
          </CardTitle>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prescription Image/PDF
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              {!file ? (
                <div>
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-600 mb-2">Click to select or drag and drop</p>
                  <p className="text-xs text-gray-500">Supported: JPEG, PNG, PDF (max 10MB)</p>
                  <Button type="button" onClick={() => fileInputRef.current?.click()} className="mt-4">
                    Select File
                  </Button>
                </div>
              ) : (
                <div>
                  <FileText className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setParsed(null);
                    }}
                    className="mt-4"
                  >
                    Change File
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Parse Button */}
          {file && !parsed && (
            <Button onClick={handleUpload} disabled={isUploading} className="w-full">
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Parsing Prescription...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Parse Prescription
                </>
              )}
            </Button>
          )}

          {/* Parsed Results */}
          {parsed && (
            <div className="space-y-4">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <p className="text-sm text-green-800">
                  Prescription parsed successfully (Confidence: {(parsed.confidence * 100).toFixed(0)}%)
                </p>
              </div>

              {/* Doctor Info */}
              {(parsed.doctorName || parsed.date) && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2">Prescription Details</h4>
                  <div className="text-sm space-y-1">
                    {parsed.doctorName && (
                      <div>
                        <strong>Doctor:</strong> {parsed.doctorName}
                      </div>
                    )}
                    {parsed.date && (
                      <div>
                        <strong>Date:</strong> {parsed.date}
                      </div>
                    )}
                    {parsed.patientName && (
                      <div>
                        <strong>Patient:</strong> {parsed.patientName}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Parsed Lines */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Medications Detected</h4>
                {parsed.lines?.map((line: ParsedLine, idx: number) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border-2 ${
                      line.confidence < 0.5 ? "border-yellow-300 bg-yellow-50" : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-semibold">{line.medicationName}</div>
                        {line.strength && (
                          <div className="text-sm text-gray-600">
                            {line.strength} {line.dosageForm}
                          </div>
                        )}
                      </div>
                      {line.confidence < 0.5 && (
                        <div className="text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                          Low Confidence
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      {line.frequency && (
                        <div>
                          <strong>Frequency:</strong> {line.frequency}
                        </div>
                      )}
                      {line.duration && (
                        <div>
                          <strong>Duration:</strong> {line.duration}
                        </div>
                      )}
                      {line.quantity && (
                        <div>
                          <strong>Quantity:</strong> {line.quantity}
                        </div>
                      )}
                      {line.instructions && (
                        <div>
                          <strong>Instructions:</strong> {line.instructions}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={() => setShowCartBuilder(true)} className="flex-1">
                  Map to Drug Library
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cart Builder Modal */}
      {parsed && parsed.lines && (
        <CartBuilderModal
          isOpen={showCartBuilder}
          onClose={() => setShowCartBuilder(false)}
          parsedLines={parsed.lines}
          onAddToCart={handleCartBuilt}
        />
      )}
    </div>
  );
}
