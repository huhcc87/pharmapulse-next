'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  User,
  Bell,
  Shield,
  CreditCard,
  Moon,
  Sun,
  Save,
  RefreshCw,
  Calendar,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  IndianRupee,
  Smartphone,
  Building2,
  FileText,
  Check,
  Lock,
  Users,
  Key,
  Eye,
  Download,
  Clock,
  Settings2,
  BarChart3,
  Keyboard,
} from 'lucide-react';

import { ShortcutsHelpButton } from '@/components/keyboard-shortcuts/ShortcutsHelpButton';
import { isMac } from '@/lib/keyboard-shortcuts/platform';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * DROP-IN FULL REPLACEMENT
 *
 * Fixes TS build error:
 *   Type 'boolean | null' is not assignable to type 'boolean | undefined'
 *
 * Root cause:
 *   disabled={billingLoading || (paymentProviderStatus && !paymentProviderStatus.available)}
 *   When paymentProviderStatus is null, the expression becomes null.
 *
 * Fix:
 *   Compute a strict boolean paymentUnavailable and use it in disabled props.
 */

// Indian States for billing
const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

// Payment methods for Indian market
const PAYMENT_METHODS = [
  { id: 'card', name: 'Credit/Debit Card', icon: CreditCard, popular: true },
  { id: 'upi', name: 'UPI', icon: Smartphone, popular: true },
  { id: 'razorpay', name: 'Razorpay', icon: Building2, popular: false },
  { id: 'paytm', name: 'Paytm', icon: Smartphone, popular: false },
  { id: 'netbanking', name: 'Net Banking', icon: Building2, popular: false },
];

// Yearly Plan - Single Subscription Plan
const YEARLY_PLAN = {
  name: 'Yearly Plan',
  yearlyPrice: 15000, // ₹15,000/year
  features: ['1 Branch', 'All Features', '10,000 AI Credits/month (120,000/year total)', 'Priority Support'],
  monthlyCreditGrant: 10000,
  yearlyCreditTotal: 120000,
};

type BillingStatus = {
  plan: {
    name: string | null;
    status: 'ACTIVE' | 'INACTIVE' | string;
    purchasedAt: string | null;
    amountPaise: number | null;
    branchesIncluded: number;
    prioritySupport: boolean;
    subscriptionStatus?: 'ACTIVE' | 'PAST_DUE' | 'INACTIVE' | string;
  };
  renewal: {
    status: 'ACTIVE' | 'INACTIVE' | string;
    nextDue: string | null;
    isPastDue: boolean;
  };
  credits: {
    balance: number;
    monthlyGrant: number;
    yearlyLimit: number;
    used: number;
    yearlyUsed: number;
    monthlyUsed: number;
    remaining: number;
    remainingYearly: number;
    remainingMonthly: number;
  };
};

function safeJsonResponse(status = 401, body: any = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function readJsonOrNull<T = any>(res: Response): Promise<T | null> {
  try {
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [activeTab, setActiveTab] = useState('profile');
  const [isMacOS, setIsMacOS] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') setIsMacOS(isMac());
  }, []);

  const [billingStatus, setBillingStatus] = useState<BillingStatus>({
    plan: {
      name: null,
      status: 'INACTIVE',
      purchasedAt: null,
      amountPaise: null,
      branchesIncluded: 1,
      prioritySupport: false,
      subscriptionStatus: 'INACTIVE',
    },
    renewal: { status: 'INACTIVE', nextDue: null, isPastDue: false },
    credits: {
      balance: 0,
      monthlyGrant: 10000,
      yearlyLimit: 120000,
      used: 0,
      yearlyUsed: 0,
      monthlyUsed: 0,
      remaining: 0,
      remainingYearly: 120000,
      remainingMonthly: 10000,
    },
  });

  const [billingLoading, setBillingLoading] = useState(false);

  const [paymentProviderStatus, setPaymentProviderStatus] = useState<{
    razorpay: boolean;
    stripe: boolean;
    available: boolean;
    message?: string;
  } | null>(null);

  // STRICT boolean for TS-safe disabled props
  const paymentUnavailable = Boolean(paymentProviderStatus && !paymentProviderStatus.available);

  const [billingAddress, setBillingAddress] = useState({
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstin: '',
  });

  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    push: true,
    lowStock: true,
    expiry: true,
    orders: true,
  });

  const [profileData, setProfileData] = useState({
    name: 'Admin User',
    email: 'admin@pharmapulse.com',
    phone: '+91 98765 43210',
    role: 'Owner',
    pharmacyName: 'PharmaPulse Pharmacy',
    address: '123 Main Street, Mumbai, Maharashtra 400001',
    gstNumber: '27ABCDE1234F1Z5',
    licenseNumber: 'PHARM-2024-001',
  });

  const [security, setSecurity] = useState({
    twoFactor: false,
    sessionTimeout: '30',
    passwordExpiry: '90',
  });

  const [securityConfig, setSecurityConfig] = useState({
    refundThreshold: 1000,
    discountThreshold: 10,
    exportRateLimit: 10,
    stepUpTimeoutMinutes: 10,
    supportSessionMinutes: 30,
    loading: true,
  });

  const [rbacInfo, setRbacInfo] = useState<any>(null);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [supportStatus, setSupportStatus] = useState<any>(null);

  const [analyticsUsers, setAnalyticsUsers] = useState<any[]>([]);
  const [analyticsUsersLoading, setAnalyticsUsersLoading] = useState(false);

  // Load security data
  useEffect(() => {
    if (activeTab === 'security') {
      loadSecurityData();
      loadAnalyticsUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Load billing data
  useEffect(() => {
    if (activeTab === 'billing') {
      loadBillingStatus();
      loadPaymentProviderStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadPaymentProviderStatus = async () => {
    try {
      const res = await fetch('/api/billing/payment-status', { cache: 'no-store' });
      const data = await readJsonOrNull(res);
      if (res.ok && data) setPaymentProviderStatus(data);
    } catch (error) {
      console.error('Failed to load payment provider status:', error);
    }
  };

  const loadBillingStatus = async () => {
    const defaultStatus: BillingStatus = {
      plan: {
        name: null,
        status: 'INACTIVE',
        purchasedAt: null,
        amountPaise: null,
        branchesIncluded: 1,
        prioritySupport: false,
        subscriptionStatus: 'INACTIVE',
      },
      renewal: { status: 'INACTIVE', nextDue: null, isPastDue: false },
      credits: {
        balance: 0,
        monthlyGrant: 10000,
        yearlyLimit: 120000,
        used: 0,
        yearlyUsed: 0,
        monthlyUsed: 0,
        remaining: 0,
        remainingYearly: 120000,
        remainingMonthly: 10000,
      },
    };

    try {
      setBillingLoading(true);

      const res = await fetch('/api/billing/status', {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
      });

      const parsed = (await readJsonOrNull<any>(res)) ?? null;

      if (res.ok && parsed && !parsed.error && (parsed.plan || parsed.renewal || parsed.credits)) {
        const data = {
          plan: parsed.plan || defaultStatus.plan,
          renewal: parsed.renewal || defaultStatus.renewal,
          credits: parsed.credits || defaultStatus.credits,
        };

        setBillingStatus({
          plan: {
            name: data.plan?.name || null,
            status: data.plan?.status || 'INACTIVE',
            purchasedAt: data.plan?.purchasedAt || null,
            amountPaise: data.plan?.amountPaise ?? null,
            branchesIncluded: data.plan?.branchesIncluded || 1,
            prioritySupport: !!data.plan?.prioritySupport,
            subscriptionStatus: data.plan?.subscriptionStatus || data.plan?.status || 'INACTIVE',
          },
          renewal: {
            status: data.renewal?.status || 'INACTIVE',
            nextDue: data.renewal?.nextDue || null,
            isPastDue: !!data.renewal?.isPastDue,
          },
          credits: {
            balance: data.credits?.balance ?? 0,
            monthlyGrant: data.credits?.monthlyGrant ?? 10000,
            yearlyLimit: data.credits?.yearlyLimit ?? 120000,
            used: data.credits?.used ?? 0,
            yearlyUsed: data.credits?.yearlyUsed ?? 0,
            monthlyUsed: data.credits?.monthlyUsed ?? 0,
            remaining: data.credits?.remaining ?? 0,
            remainingYearly: data.credits?.remainingYearly ?? 120000,
            remainingMonthly: data.credits?.remainingMonthly ?? 10000,
          },
        });
      } else {
        setBillingStatus(defaultStatus);
      }
    } catch (error: any) {
      console.warn('Billing status load failed (using default - non-fatal):', error?.message || error);
      setBillingStatus(defaultStatus);
    } finally {
      setBillingLoading(false);
    }
  };

  const handleSubscribeYearly = async () => {
    try {
      setBillingLoading(true);

      const orderRes = await fetch('/api/billing/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const orderData = (await readJsonOrNull<any>(orderRes)) ?? {};

      if (!orderRes.ok) {
        if (orderRes.status === 401) {
          if (confirm('Please log in to subscribe. Would you like to go to the login page?')) {
            window.location.href = '/login';
          }
          return;
        }
        const msg = orderData.message || orderData.error || 'Please try again';
        alert(
          `Unable to create order: ${msg}\n\n${
            orderData.error === 'Payment provider not configured'
              ? 'Please configure Razorpay or Stripe in environment variables.'
              : ''
          }`,
        );
        return;
      }

      if (orderData.error) {
        alert(`Error: ${orderData.error}`);
        return;
      }

      if (orderData.provider === 'stripe' && orderData.checkoutUrl) {
        window.location.href = orderData.checkoutUrl;
        return;
      }

      if (orderData.provider === 'stripe' && orderData.clientSecret) {
        alert('Stripe payment requires redirect to checkout. Please contact support.');
        return;
      }

      if (!orderData.keyId || !orderData.orderId) {
        alert('Invalid order data received. Please try again.');
        return;
      }

      const { openRazorpayCheckout } = await import('@/lib/razorpay/checkout');

      await openRazorpayCheckout({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'PharmaPulse AI',
        description: `Yearly Plan ₹15,000/year`,
        order_id: orderData.orderId,
        prefill: { email: profileData.email, name: profileData.name },
        theme: { color: '#10b981' },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch('/api/billing/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = (await readJsonOrNull<any>(verifyRes)) ?? {};

            if (!verifyRes.ok || verifyData.error) {
              alert(`Payment verification failed: ${verifyData.error || 'Please contact support'}`);
              return;
            }

            alert('Payment successful! Your subscription is now active.');
            loadBillingStatus();
          } catch (verifyError: any) {
            console.error('Verify error:', verifyError);
            alert('Payment was successful but verification failed. Please contact support with your payment ID.');
          }
        },
        modal: {
          ondismiss: () => console.log('Payment modal closed'),
        },
      });
    } catch (error: any) {
      console.error('Subscribe error:', error);

      if (error.message?.includes('Razorpay SDK not loaded') || error.message?.includes('Failed to load')) {
        alert('Failed to load payment gateway. Please check your internet connection and try again.');
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        alert('Network error: Please check your internet connection and try again.');
      } else {
        alert(`Unable to start subscription: ${error.message || 'Please try again later'}`);
      }
    } finally {
      setBillingLoading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const res = await fetch('/api/billing/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        console.error('Unexpected response type:', contentType, text);
        alert(`Error: Server returned an invalid response. Please try again.`);
        return;
      }

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errMsg = data?.error || data?.message || `Failed to open billing portal (Status: ${res.status})`;
        alert(`Error: ${errMsg}`);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        alert('Billing portal URL not available. Please contact support.');
      }
    } catch (error: any) {
      console.error('Manage billing error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        alert('Error: Network error. Please check your connection and try again.');
      } else {
        alert(`Error: ${error.message || 'Failed to open billing portal'}`);
      }
    }
  };

  const loadAnalyticsUsers = async () => {
    try {
      setAnalyticsUsersLoading(true);
      const res = await fetch('/api/admin/org/users', { cache: 'no-store' });
      const data = await readJsonOrNull<any>(res);
      if (res.ok && data) setAnalyticsUsers(data.users || []);
    } catch (error) {
      console.error('Failed to load analytics users:', error);
    } finally {
      setAnalyticsUsersLoading(false);
    }
  };

  const handleGrantAnalyticsPermission = async (userId: string, permission: string) => {
    try {
      const res = await fetch('/api/admin/permissions/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, permission }),
      });
      const data = await readJsonOrNull<any>(res);

      if (res.ok) {
        alert(`Permission ${permission} granted!`);
        loadAnalyticsUsers();
      } else {
        alert(`Error: ${data?.error || data?.message || 'Failed to grant permission'}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleRevokeAnalyticsPermission = async (userId: string, permission: string) => {
    if (!confirm(`Revoke ${permission} from this user?`)) return;
    try {
      const res = await fetch('/api/admin/permissions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, permission }),
      });
      const data = await readJsonOrNull<any>(res);

      if (res.ok) {
        alert(`Permission ${permission} revoked!`);
        loadAnalyticsUsers();
      } else {
        alert(`Error: ${data?.error || data?.message || 'Failed to revoke permission'}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  /**
   * loadSecurityData:
   * - All catch() return Response objects => consistent Response typing
   * - .json() calls always valid on Response
   */
  const loadSecurityData = async () => {
    try {
      const [rbacRes, configRes, actionsRes, auditRes, supportRes] = await Promise.all([
        fetch('/api/security/rbac', { cache: 'no-store' }).catch(() => safeJsonResponse(401, {})),
        fetch('/api/security/config', { cache: 'no-store' }).catch(() => safeJsonResponse(401, {})),
        fetch('/api/security/pending-actions?status=PENDING', { cache: 'no-store' }).catch(() =>
          safeJsonResponse(401, { actions: [] }),
        ),
        fetch('/api/security/audit?limit=10', { cache: 'no-store' }).catch(() => safeJsonResponse(401, { logs: [] })),
        fetch('/api/security/support/status', { cache: 'no-store' }).catch(() => safeJsonResponse(401, {})),
      ]);

      if (rbacRes.ok) {
        const data = await readJsonOrNull<any>(rbacRes);
        if (data) setRbacInfo(data);
      }

      if (configRes.ok) {
        const config = await readJsonOrNull<any>(configRes);
        if (config) setSecurityConfig({ ...config, loading: false });
        else setSecurityConfig((prev) => ({ ...prev, loading: false }));
      } else {
        setSecurityConfig((prev) => ({ ...prev, loading: false }));
      }

      if (actionsRes.ok) {
        const data = await readJsonOrNull<any>(actionsRes);
        setPendingActions(data?.actions || []);
      } else {
        setPendingActions([]);
      }

      if (auditRes.ok) {
        const data = await readJsonOrNull<any>(auditRes);
        setAuditLogs(data?.logs || []);
      } else {
        setAuditLogs([]);
      }

      if (supportRes.ok) {
        const data = await readJsonOrNull<any>(supportRes);
        if (data) setSupportStatus(data);
      }
    } catch (error) {
      console.error('Failed to load security data:', error);
      setSecurityConfig((prev) => ({ ...prev, loading: false }));
      setPendingActions([]);
      setAuditLogs([]);
    }
  };

  const handleUpdateConfig = async () => {
    try {
      const res = await fetch('/api/security/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(securityConfig),
      });
      const data = await readJsonOrNull<any>(res);

      if (res.ok) {
        alert('Security configuration updated!');
        loadSecurityData();
      } else {
        alert(`Error: ${data?.error || data?.message || 'Failed to update config'}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleApproveAction = async (actionId: string) => {
    try {
      const res = await fetch('/api/security/pending-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId }),
      });
      const data = await readJsonOrNull<any>(res);

      if (res.ok) {
        alert('Action approved!');
        loadSecurityData();
      } else {
        alert(`Error: ${data?.error || data?.message || 'Failed to approve action'}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleEnableSupport = async () => {
    if (!confirm('Enable support mode for 30 minutes? This allows support to view diagnostics.')) return;
    try {
      const res = await fetch('/api/security/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'READ_ONLY', durationMinutes: 30 }),
      });
      const data = await readJsonOrNull<any>(res);

      if (res.ok) {
        alert('Support mode enabled!');
        loadSecurityData();
      } else {
        alert(`Error: ${data?.error || data?.message || 'Failed to enable support mode'}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const [licensing, setLicensing] = useState({
    licence: null as any,
    device: null as any,
    ip: null as any,
    auditLogs: [] as any[],
    violations: [] as any[],
    loading: true,
  });

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'licensing', label: 'Security & Licensing', icon: Lock },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'general', label: 'General', icon: Settings },
  ];

  // Load licensing data
  useEffect(() => {
    if (activeTab === 'licensing') {
      loadLicensingData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadLicensingData = async () => {
    try {
      setLicensing((prev) => ({ ...prev, loading: true }));

      const [licenceRes, deviceRes, ipRes, auditRes, violationsRes] = await Promise.all([
        fetch('/api/licensing/licence', { cache: 'no-store' }).catch(() => safeJsonResponse(401, { error: 'UNAUTHORIZED' })),
        fetch('/api/licensing/device', { cache: 'no-store' }).catch(() => safeJsonResponse(401, { error: 'UNAUTHORIZED' })),
        fetch('/api/licensing/ip', { cache: 'no-store' }).catch(() => safeJsonResponse(401, { error: 'UNAUTHORIZED' })),
        fetch('/api/licensing/audit?limit=10', { cache: 'no-store' }).catch(() => safeJsonResponse(401, { logs: [] })),
        fetch('/api/licensing/violations?limit=5', { cache: 'no-store' }).catch(() =>
          safeJsonResponse(401, { violations: [] }),
        ),
      ]);

      const licenceData = licenceRes.ok ? await readJsonOrNull<any>(licenceRes) : null;
      const deviceData = deviceRes.ok ? await readJsonOrNull<any>(deviceRes) : (await readJsonOrNull<any>(deviceRes)) ?? null;
      const ipData = ipRes.ok ? await readJsonOrNull<any>(ipRes) : (await readJsonOrNull<any>(ipRes)) ?? null;
      const auditData = auditRes.ok ? await readJsonOrNull<any>(auditRes) : { logs: [] };
      const violationsData = violationsRes.ok ? await readJsonOrNull<any>(violationsRes) : { violations: [] };

      setLicensing({
        licence: licenceData?.licence || licenceData || null,
        device: deviceData || null,
        ip: ipData || null,
        auditLogs: auditData?.logs || [],
        violations: violationsData?.violations || [],
        loading: false,
      });
    } catch (error) {
      console.error('Failed to load licensing data:', error);
      setLicensing((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleSave = async () => {
    alert('Settings saved successfully!');
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your account settings and preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <nav className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Profile Settings</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pharmacy Name</label>
                  <input
                    type="text"
                    value={profileData.pharmacyName}
                    onChange={(e) => setProfileData({ ...profileData, pharmacyName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Address</label>
                  <textarea
                    value={profileData.address}
                    onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">GST Number</label>
                    <input
                      type="text"
                      value={profileData.gstNumber}
                      onChange={(e) => setProfileData({ ...profileData, gstNumber: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">License Number</label>
                    <input
                      type="text"
                      value={profileData.licenseNumber}
                      onChange={(e) => setProfileData({ ...profileData, licenseNumber: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Notification Preferences</h2>

              <div className="space-y-4">
                {[
                  { title: 'Email Notifications', desc: 'Receive notifications via email', keyName: 'email' as const },
                  { title: 'SMS Notifications', desc: 'Receive notifications via SMS', keyName: 'sms' as const },
                  { title: 'Push Notifications', desc: 'Receive push notifications on mobile app', keyName: 'push' as const },
                ].map((row) => (
                  <div
                    key={row.keyName}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                  >
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{row.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{row.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifications[row.keyName]}
                        onChange={(e) => setNotifications({ ...notifications, [row.keyName]: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600 dark:peer-checked:bg-teal-500"></div>
                    </label>
                  </div>
                ))}

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4">Notification Types</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Low Stock Alerts', keyName: 'lowStock' as const },
                      { label: 'Expiry Alerts', keyName: 'expiry' as const },
                      { label: 'New Orders', keyName: 'orders' as const },
                    ].map((row) => (
                      <div key={row.keyName} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{row.label}</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={notifications[row.keyName]}
                            onChange={(e) => setNotifications({ ...notifications, [row.keyName]: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600 dark:peer-checked:bg-teal-500"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Security Settings</h2>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Two-Factor Authentication</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Add an extra layer of security to your account</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={security.twoFactor}
                      onChange={(e) => setSecurity({ ...security, twoFactor: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600 dark:peer-checked:bg-teal-500"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Session Timeout (minutes)
                  </label>
                  <select
                    value={security.sessionTimeout}
                    onChange={(e) => setSecurity({ ...security, sessionTimeout: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="120">2 hours</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password Expiry (days)
                  </label>
                  <select
                    value={security.passwordExpiry}
                    onChange={(e) => setSecurity({ ...security, passwordExpiry: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="30">30 days</option>
                    <option value="60">60 days</option>
                    <option value="90">90 days</option>
                    <option value="180">180 days</option>
                    <option value="never">Never</option>
                  </select>
                </div>

                {/* Enterprise Security Management */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Enterprise Security
                  </h3>

                  {rbacInfo && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Your Roles & Permissions
                      </h4>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {rbacInfo.roles?.map((role: string) => (
                          <Badge key={role} className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                            {role}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-sm text-blue-800 dark:text-blue-300">
                        <strong>Permissions:</strong> {rbacInfo.permissions?.join(', ') || 'None'}
                      </div>
                    </div>
                  )}

                  <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Settings2 className="w-4 h-4" />
                      Security Thresholds
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Refund Threshold (₹)
                        </label>
                        <input
                          type="number"
                          value={securityConfig.refundThreshold}
                          onChange={(e) =>
                            setSecurityConfig({ ...securityConfig, refundThreshold: parseFloat(e.target.value) })
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Requires approval above this amount</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Discount Threshold (%)
                        </label>
                        <input
                          type="number"
                          value={securityConfig.discountThreshold}
                          onChange={(e) =>
                            setSecurityConfig({ ...securityConfig, discountThreshold: parseFloat(e.target.value) })
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Requires approval above this %</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Export Rate Limit (per hour)
                        </label>
                        <input
                          type="number"
                          value={securityConfig.exportRateLimit}
                          onChange={(e) =>
                            setSecurityConfig({ ...securityConfig, exportRateLimit: parseInt(e.target.value) })
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Step-up Timeout (minutes)
                        </label>
                        <input
                          type="number"
                          value={securityConfig.stepUpTimeoutMinutes}
                          onChange={(e) =>
                            setSecurityConfig({ ...securityConfig, stepUpTimeoutMinutes: parseInt(e.target.value) })
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                    </div>

                    <Button onClick={handleUpdateConfig} className="mt-4 bg-teal-500 hover:bg-teal-600 text-white">
                      <Save className="w-4 h-4 mr-2" />
                      Save Thresholds
                    </Button>
                  </div>

                  {pendingActions.length > 0 && (
                    <div className="mb-6 p-4 border border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                      <h4 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Pending Actions ({pendingActions.length})
                      </h4>
                      <div className="space-y-2">
                        {pendingActions.slice(0, 5).map((action: any) => (
                          <div
                            key={action.id}
                            className="p-3 bg-white dark:bg-gray-800 rounded border border-yellow-200 dark:border-yellow-800"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">{action.actionType}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Created: {new Date(action.createdAt).toLocaleString()}
                                </p>
                              </div>
                              <Button
                                onClick={() => handleApproveAction(action.id)}
                                size="sm"
                                className="bg-green-500 hover:bg-green-600 text-white"
                              >
                                Approve
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Support Mode
                    </h4>
                    {supportStatus?.active ? (
                      <div className="space-y-2">
                        <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">Active</Badge>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Expires: {new Date(supportStatus.session.expiresAt).toLocaleString()}
                        </p>
                        <Button
                          onClick={async () => {
                            const res = await fetch('/api/security/support', { method: 'DELETE' });
                            if (res.ok) {
                              alert('Support mode revoked');
                              loadSecurityData();
                            }
                          }}
                          variant="outline"
                          size="sm"
                        >
                          Revoke
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          Enable time-bound support access for diagnostics
                        </p>
                        <Button onClick={handleEnableSupport} className="bg-teal-500 hover:bg-teal-600 text-white">
                          Enable Support Mode (30 min)
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Recent Audit Logs
                      </h4>
                      <Button
                        onClick={() => window.open('/api/security/audit?export=json', '_blank')}
                        variant="outline"
                        size="sm"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {auditLogs.length > 0 ? (
                        auditLogs.map((log: any) => (
                          <div key={log.id} className="p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-900 dark:text-white">{log.action}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(log.createdAt).toLocaleString()}
                              </span>
                            </div>
                            {log.actorUserId && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">User: {log.actorUserId}</p>
                            )}
                          </div>
                        ))
                      ) : securityConfig.loading ? (
                        <div className="text-center py-4">
                          <RefreshCw className="w-5 h-5 animate-spin text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-500 dark:text-gray-400">Loading audit logs...</p>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No audit logs yet</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            Audit logs will appear here as security actions are performed
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Billing & Subscription</h2>

              <div className="space-y-6">
                {billingLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-600 dark:text-gray-400">Loading billing status...</span>
                  </div>
                ) : (
                  <>
                    <div
                      className={`bg-gradient-to-r rounded-lg p-6 border ${
                        billingStatus?.plan?.status === 'ACTIVE'
                          ? 'from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 border-green-200 dark:border-green-800'
                          : 'from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Current Plan</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {billingStatus?.plan?.name || 'No active plan'}
                          </p>
                        </div>

                        {billingStatus?.plan?.status === 'ACTIVE' ? (
                          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            <XCircle className="w-3 h-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </div>

                      {billingStatus?.plan?.status === 'ACTIVE' ? (
                        <div className="space-y-4 mb-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Plan</p>
                              <p className="text-xl font-bold text-gray-900 dark:text-white">
                                {billingStatus?.plan?.name || '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Purchased
                              </p>
                              <p className="text-xl font-bold text-gray-900 dark:text-white">
                                {billingStatus?.plan?.purchasedAt
                                  ? new Date(billingStatus.plan.purchasedAt).toLocaleDateString()
                                  : '—'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 mb-2">
                                <Zap className="w-4 h-4" />
                                Available Balance
                              </p>
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {billingStatus?.credits?.balance?.toLocaleString() || 0}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Credits available to use</p>
                            </div>

                            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 mb-2">
                                <BarChart3 className="w-4 h-4" />
                                Monthly Usage
                              </p>
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {billingStatus?.credits?.monthlyUsed?.toLocaleString() || 0}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                of {(billingStatus?.credits?.monthlyGrant?.toLocaleString() || '10,000')} this month
                              </p>
                            </div>

                            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 mb-2">
                                <Calendar className="w-4 h-4" />
                                Yearly Usage
                              </p>
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {billingStatus?.credits?.yearlyUsed?.toLocaleString() || 0}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                of {(billingStatus?.credits?.yearlyLimit?.toLocaleString() || '120,000')} this year
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-gray-600 dark:text-gray-400 mb-4">
                            No active subscription. Subscribe to Yearly Plan to get started.
                          </p>
                        </div>
                      )}

                      {paymentProviderStatus && !paymentProviderStatus.available && (
                        <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                                Payment Provider Not Configured
                              </p>
                              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                                {paymentProviderStatus.message || 'Please configure Razorpay or Stripe to enable payments.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3">
                        {billingStatus?.plan?.status !== 'ACTIVE' ? (
                          <Button
                            onClick={handleSubscribeYearly}
                            disabled={billingLoading || paymentUnavailable}
                            className="w-full bg-teal-500 hover:bg-teal-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {billingLoading ? 'Processing...' : 'Subscribe Yearly (₹15,000/year)'}
                          </Button>
                        ) : (
                          <Button onClick={handleManageBilling} variant="outline" className="w-full">
                            Manage Subscription
                          </Button>
                        )}
                      </div>
                    </div>

                    {billingStatus?.plan?.status !== 'ACTIVE' && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-teal-500 p-6">
                        <div className="text-center mb-6">
                          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{YEARLY_PLAN.name}</h3>
                          <div className="flex items-baseline justify-center gap-1">
                            <IndianRupee className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                            <span className="text-4xl font-bold text-gray-900 dark:text-white">
                              {YEARLY_PLAN.yearlyPrice.toLocaleString('en-IN')}
                            </span>
                            <span className="text-gray-600 dark:text-gray-400"> / year</span>
                          </div>
                        </div>
                        <ul className="space-y-3 mb-6">
                          {YEARLY_PLAN.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <Check className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                        <Button
                          onClick={handleSubscribeYearly}
                          disabled={billingLoading || paymentUnavailable}
                          className="w-full bg-teal-500 hover:bg-teal-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {billingLoading ? 'Processing...' : 'Subscribe Yearly'}
                        </Button>
                      </div>
                    )}

                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white mb-4">Supported Payment Methods</h3>
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                        <div className="flex flex-wrap gap-2">
                          {PAYMENT_METHODS.map((method) => {
                            const Icon = method.icon;
                            return (
                              <button
                                key={method.id}
                                type="button"
                                onClick={() => {
                                  if (billingStatus?.plan?.status !== 'ACTIVE') handleSubscribeYearly();
                                }}
                                disabled={billingLoading || billingStatus?.plan?.status === 'ACTIVE'}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                              >
                                <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                <span className="text-xs text-gray-600 dark:text-gray-400">{method.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white mb-4">Billing History & GST Invoices</h3>
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-8 bg-white dark:bg-gray-800">
                        <div className="text-center">
                          <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-600 dark:text-gray-400 mb-2">
                            {billingStatus?.plan?.status === 'ACTIVE' ? 'No billing history yet' : 'No billing history'}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-500">
                            {billingStatus?.plan?.status === 'ACTIVE'
                              ? 'Your invoices and GST-compliant receipts will appear here once payments are processed'
                              : 'Your billing history and GST invoices will appear here once you purchase a plan'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
                        <IndianRupee className="w-5 h-5" />
                        India-First Features
                      </h4>
                      <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                        <li>✓ GST-compliant invoices with HSN codes</li>
                        <li>✓ Support for UPI, Razorpay, Paytm, and cards</li>
                        <li>✓ Automatic tax calculations (CGST, SGST, IGST)</li>
                        <li>✓ Indian currency formatting (₹)</li>
                        <li>✓ All 28 states and 8 union territories supported</li>
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* General Tab */}
          {activeTab === 'general' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">General Settings</h2>

              <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Keyboard className="w-5 h-5" />
                      Keyboard Shortcuts
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Speed up your workflow with keyboard shortcuts. Press {isMacOS ? '⌘' : 'Ctrl'}+K to open command palette.
                    </p>
                  </div>
                  <ShortcutsHelpButton variant="default" size="sm" showIcon={true} />
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        {resolvedTheme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                        Theme
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Choose your preferred theme mode</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                        theme === 'light'
                          ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-500 dark:border-teal-400 text-teal-700 dark:text-teal-300'
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Sun className="w-4 h-4 mx-auto mb-1" />
                      <span className="text-sm font-medium">Light</span>
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                        theme === 'dark'
                          ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-500 dark:border-teal-400 text-teal-700 dark:text-teal-300'
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Moon className="w-4 h-4 mx-auto mb-1" />
                      <span className="text-sm font-medium">Dark</span>
                    </button>
                    <button
                      onClick={() => setTheme('system')}
                      className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                        theme === 'system'
                          ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-500 dark:border-teal-400 text-teal-700 dark:text-teal-300'
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Settings className="w-4 h-4 mx-auto mb-1" />
                      <span className="text-sm font-medium">System</span>
                    </button>
                  </div>
                  {theme === 'system' && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                      Following system preference ({resolvedTheme === 'dark' ? 'Dark' : 'Light'})
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Language</label>
                  <select className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option>English</option>
                    <option>Hindi</option>
                    <option>Marathi</option>
                    <option>Gujarati</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Time Zone</label>
                  <select className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option>Asia/Kolkata (IST)</option>
                    <option>UTC</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date Format</label>
                  <select className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option>DD/MM/YYYY</option>
                    <option>MM/DD/YYYY</option>
                    <option>YYYY-MM-DD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Currency</label>
                  <select className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option>Indian Rupee (₹)</option>
                    <option>US Dollar ($)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          {(activeTab === 'profile' || activeTab === 'notifications' || activeTab === 'security') && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <Button onClick={handleSave} className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white">
                <Save className="w-5 h-5" />
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
