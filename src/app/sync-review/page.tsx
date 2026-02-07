"use client";

import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Package, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ConflictInvoice {
  id: string;
  localId: string;
  invoiceNumber?: string;
  invoiceDate: string;
  grandTotal: number;
  conflicts: Array<{
    lineIndex: number;
    productName: string;
    issue: string;
    message: string;
    available?: number;
    required?: number;
  }>;
}

export default function SyncReviewPage() {
  const [invoices, setInvoices] = useState<ConflictInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchConflictInvoices();
  }, []);

  const fetchConflictInvoices = async () => {
    setIsLoading(true);
    try {
      // In production, fetch from API
      // const response = await fetch("/api/offline/conflict-invoices");
      // const data = await response.json();
      // setInvoices(data.invoices);

      // For now, mock data structure
      setInvoices([]);
    } catch (error) {
      console.error("Failed to fetch conflict invoices:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolve = async (
    invoiceId: string,
    resolution: {
      action: "ADJUST_QUANTITY" | "SWAP_BATCH" | "CANCEL";
      adjustments?: Array<{ lineIndex: number; newQuantity: number }>;
      batchSwap?: Array<{ lineIndex: number; newBatchId: number }>;
      cancelReason?: string;
    }
  ) => {
    try {
      // Call API to resolve conflict
      // await fetch(`/api/offline/resolve-conflict`, {
      //   method: "POST",
      //   body: JSON.stringify({ invoiceId, resolution }),
      // });

      // Refresh list
      await fetchConflictInvoices();
    } catch (error) {
      console.error("Failed to resolve conflict:", error);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Sync Conflict Review</h1>
        <p className="text-gray-600">
          Review and resolve invoices that need attention after offline sync
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Loading conflicts...</span>
        </div>
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Conflicts</h3>
            <p className="text-gray-600">
              All offline invoices have been successfully synced.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {invoices.map((invoice) => (
            <Card key={invoice.id} className="border-2 border-orange-300">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      Invoice {invoice.invoiceNumber || invoice.localId}
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {new Date(invoice.invoiceDate).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-orange-100 text-orange-800">
                    Needs Review
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Conflicts */}
                <div>
                  <h4 className="font-semibold text-sm mb-2">Conflicts Detected:</h4>
                  <div className="space-y-2">
                    {invoice.conflicts.map((conflict, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-red-50 border border-red-200 rounded-lg"
                      >
                        <div className="font-semibold text-sm text-red-900">
                          {conflict.productName}
                        </div>
                        <div className="text-xs text-red-700 mt-1">
                          {conflict.message}
                        </div>
                        {conflict.available !== undefined && (
                          <div className="text-xs text-red-600 mt-1">
                            Available: {conflict.available}, Required:{" "}
                            {conflict.required}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resolution Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() =>
                      handleResolve(invoice.id, {
                        action: "ADJUST_QUANTITY",
                        adjustments: invoice.conflicts.map((c) => ({
                          lineIndex: c.lineIndex,
                          newQuantity: c.available || 0,
                        })),
                      })
                    }
                  >
                    Adjust Quantities
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      handleResolve(invoice.id, {
                        action: "CANCEL",
                        cancelReason: "Stock unavailable",
                      })
                    }
                  >
                    Cancel Invoice
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
