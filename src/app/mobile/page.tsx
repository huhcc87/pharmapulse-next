'use client';

import { useState, useEffect } from 'react';
import { Smartphone, Download, QrCode, CheckCircle2, Apple, Play, Shield, Zap, Bell } from 'lucide-react';

interface AppStats {
  activeUsers: number;
  appRating: number | null;
  totalDownloads: number;
  uptimePercent: number | null;
  lastUpdated: string;
}

export default function MobileAppPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<'ios' | 'android'>('android');
  const [stats, setStats] = useState<AppStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/mobile/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch app stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M+`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K+`;
    }
    return num.toString();
  };

  const features = [
    { icon: Smartphone, title: 'Mobile POS', description: 'Process sales on the go with our mobile point-of-sale system' },
    { icon: QrCode, title: 'QR Code Scanner', description: 'Quick product lookup and inventory management' },
    { icon: Bell, title: 'Push Notifications', description: 'Get instant alerts for low stock, expiry, and orders' },
    { icon: Zap, title: 'Offline Mode', description: 'Works without internet - syncs when connected' },
    { icon: Shield, title: 'Secure & Encrypted', description: 'Bank-level security for all transactions' },
    { icon: CheckCircle2, title: 'Real-time Sync', description: 'All data syncs instantly across devices' },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mobile App</h1>
        <p className="text-gray-600">Download the PharmaPulse mobile app for iOS and Android</p>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-teal-500 to-blue-600 rounded-lg shadow-lg p-8 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-3xl font-bold mb-4">PharmaPulse Mobile</h2>
            <p className="text-xl mb-6 text-teal-100">Manage your pharmacy from anywhere, anytime</p>
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 bg-white text-teal-600 px-6 py-3 rounded-lg font-semibold hover:bg-teal-50 transition-colors">
                <Apple className="w-6 h-6" />
                Download for iOS
              </button>
              <button className="flex items-center gap-2 bg-white text-teal-600 px-6 py-3 rounded-lg font-semibold hover:bg-teal-50 transition-colors">
                <Play className="w-6 h-6" />
                Download for Android
              </button>
            </div>
          </div>
          <div className="hidden md:block">
            <Smartphone className="w-48 h-48 text-white opacity-80" />
          </div>
        </div>
      </div>

      {/* Platform Selection */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Download Links</h3>
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setSelectedPlatform('android')}
            className={`flex-1 p-4 border-2 rounded-lg transition-colors ${
              selectedPlatform === 'android'
                ? 'border-teal-500 bg-teal-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Play className="w-8 h-8 mx-auto mb-2 text-teal-500" />
            <div className="font-semibold text-gray-900">Android</div>
          </button>
          <button
            onClick={() => setSelectedPlatform('ios')}
            className={`flex-1 p-4 border-2 rounded-lg transition-colors ${
              selectedPlatform === 'ios'
                ? 'border-teal-500 bg-teal-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Apple className="w-8 h-8 mx-auto mb-2 text-teal-500" />
            <div className="font-semibold text-gray-900">iOS</div>
          </button>
        </div>

        {selectedPlatform === 'android' ? (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-2">Android Requirements</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Android 8.0 (Oreo) or higher</li>
                <li>• 50 MB free storage space</li>
                <li>• Internet connection for initial setup</li>
              </ul>
            </div>
            <div className="flex items-center gap-4">
              <QrCode className="w-32 h-32 text-gray-400" />
              <div>
                <p className="font-semibold mb-2">Scan QR Code to Download</p>
                <p className="text-sm text-gray-600 mb-4">Or download directly from Google Play Store</p>
                <button className="px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600">
                  <Download className="w-4 h-4 inline mr-2" />
                  Download APK
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-2">iOS Requirements</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• iOS 13.0 or higher</li>
                <li>• iPhone 6s or newer</li>
                <li>• 60 MB free storage space</li>
              </ul>
            </div>
            <div className="flex items-center gap-4">
              <QrCode className="w-32 h-32 text-gray-400" />
              <div>
                <p className="font-semibold mb-2">Scan QR Code to Download</p>
                <p className="text-sm text-gray-600 mb-4">Or download from Apple App Store</p>
                <button className="px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600">
                  <Download className="w-4 h-4 inline mr-2" />
                  Download from App Store
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Features */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Key Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-teal-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">{feature.title}</h4>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* App Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          {loading ? (
            <div className="text-sm text-gray-400">Loading...</div>
          ) : stats && stats.activeUsers > 0 ? (
            <>
              <div className="text-3xl font-bold text-teal-600 mb-2">{formatNumber(stats.activeUsers)}</div>
              <div className="text-sm text-gray-600">Active Users</div>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold text-gray-300 mb-2">—</div>
              <div className="text-sm text-gray-500">Active Users</div>
            </>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          {loading ? (
            <div className="text-sm text-gray-400">Loading...</div>
          ) : stats && stats.appRating !== null ? (
            <>
              <div className="text-3xl font-bold text-teal-600 mb-2">{stats.appRating.toFixed(1)}★</div>
              <div className="text-sm text-gray-600">App Rating</div>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold text-gray-300 mb-2">—</div>
              <div className="text-sm text-gray-500">App Rating</div>
            </>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          {loading ? (
            <div className="text-sm text-gray-400">Loading...</div>
          ) : stats && stats.totalDownloads > 0 ? (
            <>
              <div className="text-3xl font-bold text-teal-600 mb-2">{formatNumber(stats.totalDownloads)}</div>
              <div className="text-sm text-gray-600">Downloads</div>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold text-gray-300 mb-2">—</div>
              <div className="text-sm text-gray-500">Downloads</div>
            </>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          {loading ? (
            <div className="text-sm text-gray-400">Loading...</div>
          ) : stats && stats.uptimePercent !== null ? (
            <>
              <div className="text-3xl font-bold text-teal-600 mb-2">{stats.uptimePercent.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Uptime</div>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold text-gray-300 mb-2">—</div>
              <div className="text-sm text-gray-500">Uptime</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

