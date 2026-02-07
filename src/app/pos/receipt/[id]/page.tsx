import { prisma } from "@/server/prisma";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { id: parseInt(id) },
    include: { 
      lineItems: true, 
      taxLines: true,
      sellerGstin: true,
    },
  });

  if (!inv) return <div className="p-6">Not found.</div>;

  const sellerStateCode = inv.sellerGstin?.stateCode || "";
  const buyerStateCode = inv.placeOfSupply || "";
  const isInterState = sellerStateCode !== buyerStateCode;

  return (
    <div className="p-6">
      <div className="max-w-md mx-auto border p-4">
        <div className="text-center font-semibold">PharmaPulse</div>
        <div className="text-center text-sm text-slate-600">Tax Invoice</div>

        <div className="mt-3 text-sm">
          <div><span className="text-slate-600">Invoice:</span> {inv.invoiceNumber || `#${inv.id}`}</div>
          <div><span className="text-slate-600">Date:</span> {new Date(inv.invoiceDate).toLocaleString()}</div>
          {inv.buyerGstin ? <div><span className="text-slate-600">Buyer GSTIN:</span> {inv.buyerGstin}</div> : null}
          <div><span className="text-slate-600">Inter-state:</span> {isInterState ? "Yes (IGST)" : "No (CGST/SGST)"}</div>
        </div>

        <hr className="my-3" />

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600">
              <th>Item</th><th className="text-right">Amt</th>
            </tr>
          </thead>
          <tbody>
            {inv.lineItems.map((l) => (
              <tr key={l.id}>
                <td className="py-1">
                  <div className="font-medium">{l.productName}</div>
                  <div className="text-xs text-slate-600">
                    HSN {l.hsnCode ?? "-"} | {l.quantity} × ₹{(l.unitPricePaise / 100).toFixed(2)} | GST {((l.gstRateBps || 0) / 100).toFixed(2)}%
                  </div>
                </td>
                <td className="py-1 text-right">₹{((l.taxablePaise + (l.cgstPaise + l.sgstPaise + l.igstPaise)) / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <hr className="my-3" />

        <div className="text-sm space-y-1">
          <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span>₹{(inv.totalTaxablePaise / 100).toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">GST</span><span>₹{(inv.totalGstPaise / 100).toFixed(2)}</span></div>
          <div className="flex justify-between font-semibold"><span>Total</span><span>₹{(inv.totalInvoicePaise / 100).toFixed(2)}</span></div>
        </div>

        <div className="mt-4 text-xs text-slate-600">
          This print view uses browser printing. For thermal ESC/POS printing + cash drawer,
          set up the Local Print Bridge described in the documentation.
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: "setTimeout(()=>window.print(), 300);" }} />
    </div>
  );
}

