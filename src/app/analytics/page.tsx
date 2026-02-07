'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Users, Calendar, Lock, AlertTriangle, Shield } from 'lucide-react';

interface AnalyticsData {
  metrics: {
    totalRevenue: number | null;
    totalSales: number;
    productsSold: number;
    activeCustomers: number;
  };
  canViewRevenue: boolean;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState('last_30_days');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [unlockToken, setUnlockToken] = useState<string | null>(null);
  const [showStepUpModal, setShowStepUpModal] = useState(false);
  const [stepUpMethod, setStepUpMethod] = useState<'email_otp' | 'totp' | 'analytics_pin'>('email_otp');
  const [stepUpCode, setStepUpCode] = useState('');
  const [stepUpChallengeId, setStepUpChallengeId] = useState<string | null>(null);
  const [stepUpLoading, setStepUpLoading] = useState(false);
  const [stepUpError, setStepUpError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Check permission and load data
  useEffect(() => {
    checkPermissionAndLoad();
  }, []);

  const checkPermissionAndLoad = async () => {
    try {
      // Check if user has analytics permission
      const permRes = await fetch('/api/security/rbac');
      if (!permRes.ok) {
        setHasPermission(false);
        setLoading(false);
        return;
      }

      const permData = await permRes.json();
      const hasAnalytics = permData.permissions?.includes('ANALYTICS_VIEW') || 
                         permData.roles?.includes('OWNER');

      if (!hasAnalytics) {
        setHasPermission(false);
        setLoading(false);
        return;
      }

      setHasPermission(true);

      // Check for existing unlock token
      const tokenRes = await fetch('/api/security/stepup/analytics/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        if (tokenData.token) {
          setUnlockToken(tokenData.token);
          loadAnalyticsData(tokenData.token);
        } else {
          // Need step-up
          setShowStepUpModal(true);
          if (tokenData.challengeId) {
            setStepUpChallengeId(tokenData.challengeId);
            setStepUpMethod(tokenData.method);
          }
        }
      } else {
        setShowStepUpModal(true);
      }
    } catch (error) {
      console.error('Permission check error:', error);
      setHasPermission(false);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalyticsData = async (token: string) => {
    try {
      const res = await fetch(`/api/analytics/summary?range=${timeRange}`, {
        headers: {
          'x-analytics-unlock-token': token,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      } else if (res.status === 403) {
        // Token expired, need step-up again
        setUnlockToken(null);
        setShowStepUpModal(true);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  const handleStartStepUp = async () => {
    setStepUpLoading(true);
    setStepUpError(null);

    try {
      const res = await fetch('/api/security/stepup/analytics/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: stepUpMethod }),
      });

      if (res.ok) {
        const data = await res.json();
        setStepUpChallengeId(data.challengeId);
        setStepUpMethod(data.method);
      } else {
        const error = await res.json();
        setStepUpError(error.error || 'Failed to start step-up');
      }
    } catch (error: any) {
      setStepUpError(error.message || 'Failed to start step-up');
    } finally {
      setStepUpLoading(false);
    }
  };

  const handleVerifyStepUp = async () => {
    if (!stepUpChallengeId || !stepUpCode) {
      setStepUpError('Please enter verification code');
      return;
    }

    setStepUpLoading(true);
    setStepUpError(null);

    try {
      const res = await fetch('/api/security/stepup/analytics/verify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: stepUpChallengeId,
          code: stepUpCode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setUnlockToken(data.token);
        setShowStepUpModal(false);
        setStepUpCode('');
        loadAnalyticsData(data.token);
      } else {
        const error = await res.json();
        setStepUpError(error.error || 'Invalid code. Please try again.');
      }
    } catch (error: any) {
      setStepUpError(error.message || 'Verification failed');
    } finally {
      setStepUpLoading(false);
    }
  };

  // Permission denied view
  if (hasPermission === false) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto mt-20">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-6">
              You don't have permission to view Analytics. Request access from the Owner.
            </p>
            <button
              onClick={() => router.push('/settings')}
              className="px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
            >
              Go to Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading || !analyticsData) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  // Step-up modal
  if (showStepUpModal && !unlockToken) {
    return (
      <div className="p-6">
        <div className="max-w-md mx-auto mt-20">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8">
            <div className="text-center mb-6">
              <Shield className="w-16 h-16 text-teal-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify to View Analytics</h2>
              <p className="text-gray-600">
                For security, please verify your identity to access Analytics.
              </p>
            </div>

            {!stepUpChallengeId ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Verification Method
                  </label>
                  <select
                    value={stepUpMethod}
                    onChange={(e) => setStepUpMethod(e.target.value as any)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="email_otp">Email OTP</option>
                    <option value="totp">Authenticator App (TOTP)</option>
                    <option value="analytics_pin">Analytics PIN</option>
                  </select>
                </div>
                <button
                  onClick={handleStartStepUp}
                  disabled={stepUpLoading}
                  className="w-full px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50"
                >
                  {stepUpLoading ? 'Starting...' : 'Start Verification'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter Verification Code
                  </label>
                  <input
                    type="text"
                    value={stepUpCode}
                    onChange={(e) => setStepUpCode(e.target.value)}
                    placeholder={stepUpMethod === 'email_otp' ? '6-digit OTP' : stepUpMethod === 'totp' ? '6-digit TOTP' : '4-6 digit PIN'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    maxLength={6}
                  />
                </div>
                {stepUpError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-600">{stepUpError}</p>
                  </div>
                )}
                <button
                  onClick={handleVerifyStepUp}
                  disabled={stepUpLoading || !stepUpCode}
                  className="w-full px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50"
                >
                  {stepUpLoading ? 'Verifying...' : 'Verify & Unlock Analytics'}
                </button>
                <button
                  onClick={() => {
                    setStepUpChallengeId(null);
                    setStepUpCode('');
                    setStepUpError(null);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Build stats from analytics data
  const stats = [
    { 
      label: 'Total Revenue', 
      value: analyticsData.canViewRevenue && analyticsData.metrics.totalRevenue !== null
        ? `₹${analyticsData.metrics.totalRevenue.toLocaleString()}`
        : '—',
      change: '0%', 
      trend: 'neutral' as const, 
      icon: DollarSign,
      hidden: !analyticsData.canViewRevenue,
    },
    { 
      label: 'Total Sales', 
      value: analyticsData.metrics.totalSales.toLocaleString(), 
      change: '0%', 
      trend: 'neutral' as const, 
      icon: ShoppingCart 
    },
    { 
      label: 'Products Sold', 
      value: analyticsData.metrics.productsSold.toLocaleString(), 
      change: '0%', 
      trend: 'neutral' as const, 
      icon: Package 
    },
    { 
      label: 'Active Customers', 
      value: analyticsData.metrics.activeCustomers.toLocaleString(), 
      change: '0%', 
      trend: 'neutral' as const, 
      icon: Users 
    },
  ].filter(s => !s.hidden);

  const topProducts: Array<{ name: string; sales: number; revenue: number; growth: string }> = [];
  const topCategories: Array<{ name: string; revenue: number; percentage: number }> = [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
          <p className="text-gray-600">Track performance metrics and insights</p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => {
            setTimeRange(e.target.value);
            if (unlockToken) {
              loadAnalyticsData(unlockToken);
            }
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="week">Last 7 Days</option>
          <option value="last_30_days">Last 30 Days</option>
          <option value="quarter">Last 3 Months</option>
          <option value="year">Last Year</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6 text-teal-600" />
                </div>
                {stat.trend !== 'neutral' && (
                  <span className={`flex items-center text-sm font-medium ${
                    stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.trend === 'up' ? (
                      <TrendingUp className="w-4 h-4 mr-1" />
                    ) : (
                      <TrendingDown className="w-4 h-4 mr-1" />
                    )}
                    {stat.change}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Chart Placeholder */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Revenue Trend</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center">
              <TrendingUp className="w-16 h-16 text-teal-500 mx-auto mb-4" />
              <p className="text-gray-600">Revenue chart visualization</p>
              <p className="text-sm text-gray-500 mt-2">Chart integration coming soon</p>
            </div>
          </div>
        </div>

        {/* Sales Chart Placeholder */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Sales Volume</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center">
              <ShoppingCart className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <p className="text-gray-600">Sales volume chart</p>
              <p className="text-sm text-gray-500 mt-2">Chart integration coming soon</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Top Selling Products</h3>
        {topProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Units Sold</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Growth</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topProducts.map((product, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-semibold mr-3">
                          {index + 1}
                        </div>
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{product.sales.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">₹{product.revenue.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {product.growth}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No product sales data yet</p>
            <p className="text-sm text-gray-500">Start making sales through the POS system to see top selling products here</p>
          </div>
        )}
      </div>

      {/* Category Performance */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Revenue by Category</h3>
        {topCategories.length > 0 ? (
          <div className="space-y-4">
            {topCategories.map((category, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">{category.name}</span>
                  <span className="text-sm font-medium text-gray-900">₹{category.revenue.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-teal-500 h-2 rounded-full"
                    style={{ width: `${category.percentage}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">{category.percentage}% of total revenue</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No category revenue data yet</p>
            <p className="text-sm text-gray-500">Category performance will appear here once you start making sales</p>
          </div>
        )}
      </div>
    </div>
  );
}

