'use client';

import { useState } from 'react';
import { FileText, Download, Calendar, TrendingUp, DollarSign, Package, Users, Filter, ChevronDown, ChevronUp } from 'lucide-react';

interface Report {
  id: number;
  name: string;
  type: string;
  description: string;
  lastGenerated: string;
  size: string;
}

export default function ReportsPage() {
  const [selectedType, setSelectedType] = useState('all');
  const [dateRange, setDateRange] = useState('today');
  const [searchTerm, setSearchTerm] = useState('');
  const [showHowToUse, setShowHowToUse] = useState(false);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports</h1>
          <p className="text-gray-600">Generate and download business reports</p>
        </div>
      </div>

      {/* Step-by-Step Guidelines - Collapsible */}
      <div className="bg-blue-50 border-l-4 border-blue-500 mb-6 rounded-r-lg overflow-hidden">
        <button
          onClick={() => setShowHowToUse(!showHowToUse)}
          className="w-full p-6 flex items-center justify-between hover:bg-blue-100 transition-colors"
        >
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-500" />
            How to Generate and Use Reports
          </h2>
          {showHowToUse ? (
            <ChevronUp className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-600" />
          )}
        </button>
        {showHowToUse && (
          <div className="px-6 pb-6 space-y-4 text-gray-700">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">1</div>
              <div>
                <h3 className="font-semibold mb-1">Sales Reports</h3>
                <p className="text-sm">Generate sales reports to track revenue, daily/weekly/monthly sales summaries, and item-wise sales breakdown. Use date range filters to analyze specific periods.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">2</div>
              <div>
                <h3 className="font-semibold mb-1">Inventory Reports</h3>
                <p className="text-sm">Create inventory reports to view current stock levels, product valuation, low stock alerts, and expiry tracking. Monitor products expiring in 30/60/90 days.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">3</div>
              <div>
                <h3 className="font-semibold mb-1">GST & Tax Reports</h3>
                <p className="text-sm">Generate GST compliance reports including HSN-wise tax summaries, invoice-wise GST breakdown, and tax liability calculations for filing returns.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">4</div>
              <div>
                <h3 className="font-semibold mb-1">Financial Reports</h3>
                <p className="text-sm">Create Profit & Loss statements, balance sheets, and financial summaries. Track revenue, expenses, and profitability over time.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">5</div>
              <div>
                <h3 className="font-semibold mb-1">Export Reports</h3>
                <p className="text-sm">All reports can be exported as CSV or PDF files. Use the download button to save reports for record-keeping, sharing with accountants, or GST filing.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">6</div>
              <div>
                <h3 className="font-semibold mb-1">Date Range Selection</h3>
                <p className="text-sm">Select date ranges (Today, This Week, This Month, Custom) to generate reports for specific time periods. Custom date ranges allow flexible analysis.</p>
              </div>
            </div>
            <div className="mt-6 p-4 bg-white rounded-lg border border-blue-200">
              <p className="text-sm font-semibold text-gray-900 mb-2">💡 Tip:</p>
              <p className="text-sm text-gray-700">Reports are generated from your actual sales, inventory, and invoice data. Ensure you have completed transactions and inventory entries before generating reports. Reports will appear here once you start using the POS and inventory management features.</p>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reports Generated Yet</h3>
        <p className="text-gray-600 mb-4">Reports will appear here once you start generating them from your sales and inventory data.</p>
        <p className="text-sm text-gray-500">To generate reports, you need to:</p>
        <ul className="text-sm text-gray-500 mt-2 text-left max-w-md mx-auto space-y-1">
          <li>• Create invoices through the POS system</li>
          <li>• Add products to inventory</li>
          <li>• Complete sales transactions</li>
        </ul>
      </div>
    </div>
  );
}

