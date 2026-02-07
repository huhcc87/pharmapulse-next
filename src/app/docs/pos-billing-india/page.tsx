export default function IndiaPosBillingDocsPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-3xl font-bold mb-6">India POS + Billing + Hardware Documentation</h1>

      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">Workflow</h2>
          <p className="text-gray-700 mb-4">
            Complete sales workflow guide for Indian pharmacy POS operations.
          </p>
          <a
            href="/docs/INDIA_POS_BILLING_WORKFLOW.md"
            className="text-blue-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Workflow Documentation →
          </a>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Hardware Integration</h2>
          <p className="text-gray-700 mb-4">
            Guide for integrating barcode scanners, thermal printers, cash drawers, and other hardware.
          </p>
          <a
            href="/docs/INDIA_HARDWARE_INTEGRATION_GUIDE.md"
            className="text-blue-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Hardware Integration Guide →
          </a>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Invoice/Receipt Templates</h2>
          <p className="text-gray-700 mb-4">
            GST-compliant invoice templates and print bridge design for thermal printing.
          </p>
          <a
            href="/docs/INDIA_INVOICE_RECEIPT_TEMPLATE.md"
            className="text-blue-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Invoice Template Documentation →
          </a>
        </section>

        <section className="border-t pt-6">
          <h2 className="text-xl font-semibold mb-4">Quick Links</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>
              <a href="/pos" className="text-blue-600 hover:underline">
                POS Terminal
              </a>
            </li>
            <li>
              <a href="/dashboard/invoices" className="text-blue-600 hover:underline">
                Invoice Dashboard
              </a>
            </li>
            <li>
              <a href="/inventory" className="text-blue-600 hover:underline">
                Inventory Management
              </a>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

