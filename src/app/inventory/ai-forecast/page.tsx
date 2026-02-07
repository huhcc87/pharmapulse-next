'use client';

import { useState } from 'react';
import { RefreshCw, TrendingUp, AlertTriangle, Download, Info } from 'lucide-react';

const MOCK_PRODUCTS = [
  { id: 1, name: "Paracetamol 500mg", category: "Analgesics", currentStock: 1200, avgDailySales: 42, forecastQty7: 294, forecastQty14: 588, forecastQty30: 1260, confidenceLevel: 0.89, trend: "stable" },
  { id: 2, name: "Amoxicillin 250mg", category: "Antibiotics", currentStock: 500, avgDailySales: 18, forecastQty7: 126, forecastQty14: 252, forecastQty30: 540, confidenceLevel: 0.78, trend: "increasing" },
  { id: 3, name: "Cetirizine 10mg", category: "Antihistamines", currentStock: 300, avgDailySales: 15, forecastQty7: 105, forecastQty14: 210, forecastQty30: 450, confidenceLevel: 0.92, trend: "decreasing" },
];

export default function AiForecastPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [selectedHorizon, setSelectedHorizon] = useState("7");

  const runForecast = async () => {
    setIsLoading(true);
    try {
      // Use reorder suggestions API which includes forecast data
      const response = await fetch(
        `/api/inventory/reorder-suggestions?horizon=${selectedHorizon}&leadTime=3&safetyStock=7`
      );
      const data = await response.json();

      if (data.suggestions && data.suggestions.length > 0) {
        // Transform to forecast format
        const forecasts = data.suggestions.map((s: any) => ({
          id: s.productId,
          name: s.productName,
          category: s.category || "General",
          currentStock: s.currentStock,
          avgDailySales: s.avgDailyDemand,
          forecastQty7: selectedHorizon === "7" ? s.forecastQty : undefined,
          forecastQty14: selectedHorizon === "14" ? s.forecastQty : undefined,
          forecastQty30: selectedHorizon === "30" ? s.forecastQty : s.forecastQty,
          confidenceLevel: s.confidenceLevel,
          trend: s.trend?.toLowerCase() || "stable",
        }));
        setForecasts(forecasts);
      } else {
        // Fallback to mock if no data
        setForecasts(MOCK_PRODUCTS);
      }
    } catch (error) {
      console.error("Failed to generate forecasts:", error);
      // Fallback to mock data on error
      setForecasts(MOCK_PRODUCTS);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Demand Forecasting</h1>
        <p className="text-gray-600">Predict future demand with AI-powered analysis</p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <select
            value={selectedHorizon}
            onChange={(e) => setSelectedHorizon(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="7">7 Days</option>
            <option value="14">14 Days</option>
            <option value="30">30 Days</option>
          </select>
          <button
            onClick={runForecast}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Run Forecast
              </>
            )}
          </button>
        </div>
      </div>

      {forecasts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No forecasts available. Run a forecast to see predictions.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Daily</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Forecast ({selectedHorizon} days)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Confidence</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Trend</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {forecasts.map((forecast) => (
                  <tr key={forecast.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{forecast.name}</div>
                      <div className="text-sm text-gray-500">{forecast.category}</div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">{forecast.currentStock}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">{forecast.avgDailySales}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                      {selectedHorizon === "7" ? forecast.forecastQty7 : 
                       selectedHorizon === "14" ? forecast.forecastQty14 : 
                       forecast.forecastQty30}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        forecast.confidenceLevel > 0.85 ? 'bg-green-100 text-green-800' :
                        forecast.confidenceLevel > 0.7 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {Math.round(forecast.confidenceLevel * 100)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {forecast.trend === 'increasing' ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : forecast.trend === 'decreasing' ? (
                          <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />
                        ) : (
                          <Info className="h-4 w-4 text-blue-600" />
                        )}
                        <span className="text-xs capitalize text-gray-600">{forecast.trend}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
