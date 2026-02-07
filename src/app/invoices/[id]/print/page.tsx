"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { formatRupees } from "@/lib/gst/taxCalculator";

export default function InvoicePrintPage() {
  const params = useParams();
  const invoiceId = (params?.id || '') as string;
  const [invoice, setInvoice] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  async function fetchInvoice() {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (res.ok) {
        const data = await res.json();
        setInvoice(data);
      }
    } catch (error) {
      console.error("Error fetching invoice:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading invoice...</div>;
  }

  if (!invoice) {
    return <div className="p-8 text-center">Invoice not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white">
      {/* Print button - hidden when printing */}
      <div className="mb-4 print:hidden">
        <button
          onClick={handlePrint}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Print Invoice
        </button>
      </div>

      {/* Invoice Content */}
      <div className="border-2 border-gray-300 p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl font-bold">{invoice.sellerGstin?.org?.name || "Pharmacy"}</h1>
            <p className="text-sm text-gray-600">
              {invoice.sellerGstin?.org?.addressLine1 || ""}
              {invoice.sellerGstin?.org?.city && `, ${invoice.sellerGstin.org.city}`}
              {invoice.sellerGstin?.org?.state && `, ${invoice.sellerGstin.org.state}`}
              {invoice.sellerGstin?.org?.pincode && ` - ${invoice.sellerGstin.org.pincode}`}
            </p>
            <p className="text-sm text-gray-600">
              GSTIN: {invoice.sellerGstin?.gstin || ""}
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold">TAX INVOICE</h2>
            <p className="text-sm text-gray-600">
              Invoice #: {invoice.invoiceNumber || `INV-${invoice.id}`}
            </p>
            <p className="text-sm text-gray-600">
              Date: {new Date(invoice.invoiceDate).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Customer Details */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold mb-2">Bill To:</h3>
            <p>{invoice.buyerName || "Walk-in Customer"}</p>
            {invoice.buyerAddress && <p className="text-sm text-gray-600">{invoice.buyerAddress}</p>}
            {invoice.buyerGstin && (
              <p className="text-sm text-gray-600">GSTIN: {invoice.buyerGstin}</p>
            )}
          </div>
          <div>
            <h3 className="font-semibold mb-2">Place of Supply:</h3>
            <p>{invoice.placeOfSupplyStateCode || invoice.sellerGstin?.stateCode || ""}</p>
            <p className="text-sm text-gray-600">
              {(invoice.supplyType || "INTRA_STATE") === "INTRA_STATE" ? "Intra-State" : "Inter-State"}
            </p>
          </div>
        </div>

        {/* Line Items */}
        <table className="w-full border-collapse mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left">Item</th>
              <th className="border p-2 text-right">HSN</th>
              <th className="border p-2 text-right">Qty</th>
              <th className="border p-2 text-right">Rate</th>
              <th className="border p-2 text-right">GST %</th>
              {(invoice.supplyType || "INTRA_STATE") === "INTRA_STATE" ? (
                <>
                  <th className="border p-2 text-right">CGST</th>
                  <th className="border p-2 text-right">SGST</th>
                </>
              ) : (
                <th className="border p-2 text-right">IGST</th>
              )}
              <th className="border p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems?.map((item: any, idx: number) => (
              <tr key={idx}>
                <td className="border p-2">{item.productName}</td>
                <td className="border p-2 text-right">{item.hsnCode || "-"}</td>
                <td className="border p-2 text-right">{item.quantity}</td>
                <td className="border p-2 text-right">{formatRupees(item.unitPricePaise)}</td>
                <td className="border p-2 text-right">
                  {item.gstRateBps ? (item.gstRateBps / 100).toFixed(2) : "0.00"}%
                </td>
                {(invoice.supplyType || "INTRA_STATE") === "INTRA_STATE" ? (
                  <>
                    <td className="border p-2 text-right">{formatRupees(item.cgstPaise)}</td>
                    <td className="border p-2 text-right">{formatRupees(item.sgstPaise)}</td>
                  </>
                ) : (
                  <td className="border p-2 text-right">{formatRupees(item.igstPaise)}</td>
                )}
                <td className="border p-2 text-right font-medium">
                  {formatRupees(item.lineTotalPaise)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-80 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Taxable Value:</span>
              <span>{formatRupees(invoice.totalTaxablePaise)}</span>
            </div>
            {(invoice.supplyType || "INTRA_STATE") === "INTRA_STATE" ? (
              <>
                <div className="flex justify-between text-sm">
                  <span>CGST:</span>
                  <span>{formatRupees(invoice.totalCGSTPaise)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>SGST:</span>
                  <span>{formatRupees(invoice.totalSGSTPaise)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-sm">
                <span>IGST:</span>
                <span>{formatRupees(invoice.totalIGSTPaise)}</span>
              </div>
            )}
            {invoice.roundOffPaise !== 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Round Off:</span>
                <span>{formatRupees(invoice.roundOffPaise)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Grand Total:</span>
              <span>{formatRupees(invoice.totalInvoicePaise)}</span>
            </div>
          </div>
        </div>

        {/* QR Code */}
        {invoice.qrPayload && (
          <div className="flex justify-center items-center gap-4 border-t pt-6">
            <div className="text-center">
              <QRCodeSVG value={invoice.qrPayload} size={150} />
              <p className="mt-2 text-xs text-gray-600">Scan to verify invoice</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>Thank you for your business!</p>
          <p className="mt-2">
            This is a computer-generated invoice and does not require a signature.
          </p>
        </div>
      </div>
    </div>
  );
}
