'use client';

import { useState, useEffect } from 'react';
import { Settings, User, Bell, Shield, CreditCard, Database, Globe, Moon, Sun, Save, RefreshCw, Calendar, Zap, AlertTriangle, CheckCircle2, XCircle, IndianRupee, Smartphone, Building2, FileText, Check, Lock, Monitor, Globe2, History, RefreshCcw, Users, Key, Eye, Download, Clock, Settings2, BarChart3, Copy, FileDown, Keyboard } from 'lucide-react';
import { ShortcutsHelpButton } from '@/components/keyboard-shortcuts/ShortcutsHelpButton';
import { isMac } from '@/lib/keyboard-shortcuts/platform';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Indian States for billing
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands',
  'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
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
  features: [
    '1 Branch',
    'All Features',
    '10,000 AI Credits/month (120,000/year total)',
    'Priority Support'
  ],
  monthlyCreditGrant: 10000, // 10,000 credits per month
  yearlyCreditTotal: 120000, // 120,000 credits per year
};

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [isMacOS, setIsMacOS] = useState(false); // Default to false to avoid hydration mismatch

  // Set on client side only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMacOS(isMac());
    }
  }, []);
  // Initialize with default inactive status to prevent null errors
  const [billingStatus, setBillingStatus] = useState<any>({
    plan: { name: null, status: 'INACTIVE', purchasedAt: null, amountPaise: null, branchesIncluded: 1, prioritySupport: false },
    renewal: { status: 'INACTIVE', nextDue: null, isPastDue: false },
    credits: { balance: 0, monthlyGrant: 10000, yearlyLimit: 120000, used: 0, yearlyUsed: 0, monthlyUsed: 0, remaining: 0, remainingYearly: 120000, remainingMonthly: 10000 },
  });
  const [billingLoading, setBillingLoading] = useState(false);
  const [paymentProviderStatus, setPaymentProviderStatus] = useState<{
    razorpay: boolean;
    stripe: boolean;
    available: boolean;
    message?: string;
  } | null>(null);
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
  }, [activeTab]);

  // Load billing data
  useEffect(() => {
    if (activeTab === 'billing') {
      loadBillingStatus();
      loadPaymentProviderStatus();
    }
  }, [activeTab]);

  const loadPaymentProviderStatus = async () => {
    try {
      const res = await fetch('/api/billing/payment-status');
      if (res.ok) {
        const data = await res.json();
        setPaymentProviderStatus(data);
      }
    } catch (error) {
      console.error('Failed to load payment provider status:', error);
    }
  };

  const loadBillingStatus = async () => {
    // Default inactive status - always used if API fails
    const defaultStatus = {
      plan: { name: null, status: 'INACTIVE' as const, purchasedAt: null, amountPaise: null, branchesIncluded: 1, prioritySupport: false },
      renewal: { status: 'INACTIVE' as const, nextDue: null, isPastDue: false },
      credits: { balance: 0, monthlyGrant: 10000, yearlyLimit: 120000, used: 0, yearlyUsed: 0, monthlyUsed: 0, remaining: 0, remainingYearly: 120000, remainingMonthly: 10000 },
    };

    try {
      setBillingLoading(true);
      
      const res = await fetch('/api/billing/status', {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      // Always try to parse as JSON - the API should always return valid JSON
      let data = defaultStatus;
      
      try {
        const text = await res.text();
        if (text && text.trim().startsWith('{')) {
          const parsed = JSON.parse(text);
          // Only use parsed data if it has the expected structure and no error field
          if (parsed && !parsed.error && (parsed.plan || parsed.renewal || parsed.credits)) {
            data = {
              plan: parsed.plan || defaultStatus.plan,
              renewal: parsed.renewal || defaultStatus.renewal,
              credits: parsed.credits || defaultStatus.credits,
            };
          }
        }
      } catch (parseError) {
        // If parsing fails, use default - never show error
        console.warn('Failed to parse billing status response (using default):', parseError);
        data = defaultStatus;
      }

      // Ensure all required fields exist and have correct structure
      setBillingStatus({
        plan: {
          name: data.plan?.name || null,
          status: data.plan?.status || 'INACTIVE',
          purchasedAt: data.plan?.purchasedAt || null,
          amountPaise: data.plan?.amountPaise || null,
          branchesIncluded: data.plan?.branchesIncluded || 1,
          prioritySupport: data.plan?.prioritySupport || false,
        },
        renewal: {
          status: data.renewal?.status || 'INACTIVE',
          nextDue: data.renewal?.nextDue || null,
          isPastDue: data.renewal?.isPastDue || false,
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
    } catch (error: any) {
      // Silently handle ALL errors - never show alerts or throw errors
      console.warn('Billing status load failed (using default - non-fatal):', error?.message || error);
      // Always set default status on any error
      setBillingStatus(defaultStatus);
    } finally {
      setBillingLoading(false);
    }
  };

  const handleSubscribeYearly = async () => {
    try {
      setBillingLoading(true);
      
      // Step 1: Create Razorpay order
      const orderRes = await fetch('/api/billing/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!orderRes.ok) {
        const errorData = await orderRes.json().catch(() => ({ error: 'Unknown error' }));
        
        if (orderRes.status === 401) {
          if (confirm('Please log in to subscribe. Would you like to go to the login page?')) {
            window.location.href = '/login';
          }
          return;
        }
        
        // Show better error message
        const errorMessage = errorData.message || errorData.error || 'Please try again';
        alert(`Unable to create order: ${errorMessage}\n\n${errorData.error === 'Payment provider not configured' ? 'Please configure Razorpay or Stripe in environment variables.' : ''}`);
        return;
      }

      const orderData = await orderRes.json();
      
      if (orderData.error) {
        alert(`Error: ${orderData.error}`);
        return;
      }

      // Check which payment provider was used
      if (orderData.provider === 'stripe' && orderData.checkoutUrl) {
        // Stripe payment flow - redirect to Stripe Checkout
        window.location.href = orderData.checkoutUrl;
        return;
      }
      
      // Legacy support for clientSecret (if still used)
      if (orderData.provider === 'stripe' && orderData.clientSecret) {
        alert('Stripe payment requires redirect to checkout. Please contact support.');
        return;
      }

      // Razorpay payment flow
      if (!orderData.keyId || !orderData.orderId) {
        alert('Invalid order data received. Please try again.');
        return;
      }

      // Step 2: Load Razorpay checkout script and open payment modal
      const { openRazorpayCheckout } = await import('@/lib/razorpay/checkout');
      
      await openRazorpayCheckout({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'PharmaPulse AI',
        description: `Yearly Plan ₹15,000/year`,
        order_id: orderData.orderId,
        prefill: {
          email: profileData.email,
          name: profileData.name,
        },
        theme: {
          color: '#10b981', // Teal color matching UI
        },
        handler: async (response) => {
          try {
            // Step 3: Verify payment
            const verifyRes = await fetch('/api/billing/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok || verifyData.error) {
              alert(`Payment verification failed: ${verifyData.error || 'Please contact support'}`);
              return;
            }

            // Success - refresh billing status
            alert('Payment successful! Your subscription is now active.');
            loadBillingStatus();
          } catch (verifyError: any) {
            console.error('Verify error:', verifyError);
            alert('Payment was successful but verification failed. Please contact support with your payment ID.');
          }
        },
        modal: {
          ondismiss: () => {
            console.log('Payment modal closed');
          },
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

      // Check content type before parsing
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error('Unexpected response type:', contentType, text);
        alert(`Error: Server returned an invalid response. Please try again.`);
        return;
      }

      if (!res.ok) {
        try {
          const error = await res.json();
          alert(`Error: ${error.error || error.message || 'Failed to open billing portal'}`);
        } catch (parseError) {
          alert(`Error: Failed to open billing portal (Status: ${res.status})`);
        }
        return;
      }

      try {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          alert('Billing portal URL not available. Please contact support.');
        }
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        alert('Error: Invalid response from server. Please try again.');
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
      const res = await fetch('/api/admin/org/users');
      if (res.ok) {
        const data = await res.json();
        setAnalyticsUsers(data.users || []);
      }
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
      if (res.ok) {
        alert(`Permission ${permission} granted!`);
        loadAnalyticsUsers();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
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
      if (res.ok) {
        alert(`Permission ${permission} revoked!`);
        loadAnalyticsUsers();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const loadSecurityData = async () => {
    try {
      const [rbacRes, configRes, actionsRes, auditRes, supportRes] = await Promise.all([
        fetch('/api/security/rbac').catch(() => ({ ok: false, status: 401 })),
        fetch('/api/security/config').catch(() => ({ ok: false, status: 401 })),
        fetch('/api/security/pending-actions?status=PENDING').catch(() => ({ ok: false, status: 401 })),
        fetch('/api/security/audit?limit=10').catch(() => ({ ok: false, status: 401 })),
        fetch('/api/security/support/status').catch(() => ({ ok: false, status: 401 })),
      ]);

      if (rbacRes?.ok) {
        try {
          setRbacInfo(await rbacRes.json());
        } catch (e) {
          console.warn('Failed to parse RBAC response:', e);
        }
      }
      if (configRes?.ok) {
        try {
          const config = await configRes.json();
          setSecurityConfig({ ...config, loading: false });
        } catch (e) {
          setSecurityConfig(prev => ({ ...prev, loading: false }));
        }
      } else {
        setSecurityConfig(prev => ({ ...prev, loading: false }));
      }
      if (actionsRes?.ok) {
        try {
          const data = await actionsRes.json();
          setPendingActions(data.actions || []);
        } catch (e) {
          // Ignore
        }
      }
      if (auditRes?.ok) {
        try {
          const data = await auditRes.json();
          setAuditLogs(data.logs || []);
        } catch (e) {
          // Ignore - might be empty or error
        }
      } else if (auditRes?.status === 401) {
        // Show helpful message
        setAuditLogs([]);
      }
      if (supportRes?.ok) {
        try {
          setSupportStatus(await supportRes.json());
        } catch (e) {
          // Ignore
        }
      }
    } catch (error) {
      console.error('Failed to load security data:', error);
      setSecurityConfig(prev => ({ ...prev, loading: false }));
    }
  };

  const handleUpdateConfig = async () => {
    try {
      const res = await fetch('/api/security/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(securityConfig),
      });
      if (res.ok) {
        alert('Security configuration updated!');
        loadSecurityData();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
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
      if (res.ok) {
        alert('Action approved!');
        loadSecurityData();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
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
      if (res.ok) {
        alert('Support mode enabled!');
        loadSecurityData();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
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
  const [showIpRequestModal, setShowIpRequestModal] = useState(false);
  const [ipRequestReason, setIpRequestReason] = useState('');
  const [showIpInput, setShowIpInput] = useState(false);
  const [customIp, setCustomIp] = useState('');

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
  }, [activeTab]);

  const loadLicensingData = async () => {
    try {
      setLicensing(prev => ({ ...prev, loading: true }));
      const [licenceRes, deviceRes, ipRes, auditRes, violationsRes] = await Promise.all([
        fetch('/api/licensing/licence').catch(err => ({ ok: false, status: 401, json: async () => ({ error: 'UNAUTHORIZED' }) })),
        fetch('/api/licensing/device').catch(err => ({ ok: false, status: 401, json: async () => ({ error: 'UNAUTHORIZED' }) })),
        fetch('/api/licensing/ip').catch(err => ({ ok: false, status: 401, json: async () => ({ error: 'UNAUTHORIZED' }) })),
        fetch('/api/licensing/audit?limit=10').catch(err => ({ ok: false, status: 401, json: async () => ({ error: 'UNAUTHORIZED' }) })),
        fetch('/api/licensing/violations?limit=5').catch(err => ({ ok: false, status: 401, json: async () => ({ violations: [] }) })),
      ]);
      
      const licenceData = licenceRes.ok ? await licenceRes.json().catch(() => null) : null;
      const deviceData = deviceRes.ok ? await deviceRes.json().catch(() => null) : null;
      const ipData = ipRes.ok ? await ipRes.json().catch(() => null) : null;
      const auditData = auditRes.ok ? await auditRes.json().catch(() => ({ logs: [] })) : { logs: [] };
      const violationsData = violationsRes.ok ? await violationsRes.json().catch(() => ({ violations: [] })) : { violations: [] };
      
      setLicensing({
        licence: licenceData?.licence || null,
        device: deviceData || null,
        ip: ipData || null,
        auditLogs: auditData?.logs || [],
        violations: violationsData?.violations || [],
        loading: false,
      });
    } catch (error) {
      console.error('Failed to load licensing data:', error);
      setLicensing(prev => ({ ...prev, loading: false }));
    }
  };

  const handleRegisterDevice = async () => {
    try {
      const res = await fetch('/api/licensing/licence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register_device' }),
      });

      if (res.ok) {
        const data = await res.json();
        alert('Device registered successfully!');
        loadLicensingData();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error || 'Failed to register device'}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleDeregisterDevice = async () => {
    if (!confirm('Are you sure you want to deregister this device? This will require admin approval to re-register.')) {
      return;
    }

    try {
      const res = await fetch('/api/licensing/licence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deregister_device' }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message || 'Device deregistered. Status set to pending renewal.');
        loadLicensingData();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error || 'Failed to deregister device'}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleSetIP = async (ip?: string) => {
    if (!confirm('Are you sure you want to change the allowed IP address? This will lock out other IP addresses.')) {
      return;
    }

    try {
      const res = await fetch('/api/licensing/ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', ip }),
      });

      if (res.ok) {
        alert('IP address updated successfully!');
        loadLicensingData();
      } else {
        const error = await res.json();
        if (error.cooldown) {
          alert(`Error: ${error.error}\nHours remaining: ${error.cooldown.hoursRemaining}`);
        } else {
          alert(`Error: ${error.error || 'Failed to update IP'}`);
        }
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleSave = async () => {
    // Only save if there are real settings to save (profile, security, etc.)
    // Dark mode is auto-saved via ThemeProvider
    alert('Settings saved successfully!');
  };


  const handlePortal = async () => {
    try {
      const res = await fetch("/api/billing/create-portal-session", {
        method: "POST",
      });

      // Check if response is JSON
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response:", text.substring(0, 200));
        alert(`Error: Server returned an error. Please check if you're logged in and try again.`);
        return;
      }

      const data = await res.json();
      if (data?.error) {
        alert(`Error: ${data.error}`);
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      } else {
        alert("No portal URL received. Please try again.");
      }
    } catch (error: any) {
      console.error("Portal error:", error);
      alert(`Failed to open billing portal: ${error.message || "Unknown error"}`);
    }
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
                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Email Notifications</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Receive notifications via email</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications.email}
                      onChange={(e) => setNotifications({ ...notifications, email: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600 dark:peer-checked:bg-teal-500"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">SMS Notifications</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Receive notifications via SMS</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications.sms}
                      onChange={(e) => setNotifications({ ...notifications, sms: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600 dark:peer-checked:bg-teal-500"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Push Notifications</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Receive push notifications on mobile app</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications.push}
                      onChange={(e) => setNotifications({ ...notifications, push: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600 dark:peer-checked:bg-teal-500"></div>
                  </label>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4">Notification Types</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Low Stock Alerts</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifications.lowStock}
                          onChange={(e) => setNotifications({ ...notifications, lowStock: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600 dark:peer-checked:bg-teal-500"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Expiry Alerts</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifications.expiry}
                          onChange={(e) => setNotifications({ ...notifications, expiry: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600 dark:peer-checked:bg-teal-500"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">New Orders</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifications.orders}
                          onChange={(e) => setNotifications({ ...notifications, orders: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600 dark:peer-checked:bg-teal-500"></div>
                      </label>
                    </div>
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Session Timeout (minutes)</label>
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password Expiry (days)</label>
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
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4">Change Password</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Password</label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">New Password</label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirm New Password</label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <button className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600">
                      Update Password
                    </button>
                  </div>
                </div>

                {/* Enterprise Security Management */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Enterprise Security
                  </h3>

                  {/* RBAC Info */}
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

                  {/* Security Thresholds */}
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
                          onChange={(e) => setSecurityConfig({ ...securityConfig, refundThreshold: parseFloat(e.target.value) })}
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
                          onChange={(e) => setSecurityConfig({ ...securityConfig, discountThreshold: parseFloat(e.target.value) })}
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
                          onChange={(e) => setSecurityConfig({ ...securityConfig, exportRateLimit: parseInt(e.target.value) })}
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
                          onChange={(e) => setSecurityConfig({ ...securityConfig, stepUpTimeoutMinutes: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                    </div>
                    <Button onClick={handleUpdateConfig} className="mt-4 bg-teal-500 hover:bg-teal-600 text-white">
                      <Save className="w-4 h-4 mr-2" />
                      Save Thresholds
                    </Button>
                  </div>

                  {/* Pending Actions (Maker-Checker) */}
                  {pendingActions.length > 0 && (
                    <div className="mb-6 p-4 border border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                      <h4 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Pending Actions ({pendingActions.length})
                      </h4>
                      <div className="space-y-2">
                        {pendingActions.slice(0, 5).map((action: any) => (
                          <div key={action.id} className="p-3 bg-white dark:bg-gray-800 rounded border border-yellow-200 dark:border-yellow-800">
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

                  {/* Support Mode */}
                  <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Support Mode
                    </h4>
                    {supportStatus?.active ? (
                      <div className="space-y-2">
                        <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                          Active
                        </Badge>
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

                  {/* Audit Logs */}
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

          {/* Security & Licensing Tab */}
          {activeTab === 'licensing' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Security & Licensing</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Manage device registration and IP address restrictions for your license (1 PC + 1 IP policy)
              </p>

              {licensing.loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Warning Banner - Expiring Soon */}
                  {licensing.licence && licensing.licence.status_display === 'expiring_soon' && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-yellow-900 dark:text-yellow-200">
                            Licence Expiring Soon
                          </h4>
                          <p className="text-sm text-yellow-800 dark:text-yellow-300">
                            Your licence expires in {licensing.licence.days_remaining} days. Please renew to avoid service interruption.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Grace Period Banner */}
                  {licensing.licence && licensing.licence.in_grace_period && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-400 p-4 rounded">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-orange-900 dark:text-orange-200">
                            Grace Period Active
                          </h4>
                          <p className="text-sm text-orange-800 dark:text-orange-300">
                            Your licence has expired. You have {licensing.licence.days_in_grace} days remaining in grace period. 
                            {licensing.licence.access_level === 'read_only' && ' Some features are disabled. Please renew to restore full access.'}
                          </p>
                          <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                            Grace period ends: {licensing.licence.grace_until ? new Date(licensing.licence.grace_until).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Read-Only Mode Banner */}
                  {licensing.licence && licensing.licence.access_level === 'read_only' && !licensing.licence.in_grace_period && (
                    <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4 rounded">
                      <div className="flex items-center gap-2">
                        <Lock className="w-5 h-5 text-red-600 dark:text-red-400" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-red-900 dark:text-red-200">
                            Read-Only Mode
                          </h4>
                          <p className="text-sm text-red-800 dark:text-red-300">
                            Your licence has expired. You have read-only access. POS billing and data exports are disabled. Please renew to restore full access.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Licence Status Panel */}
                  {licensing.licence && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <Lock className="w-5 h-5" />
                          Licence Status
                        </h3>
                        <Badge className={
                          licensing.licence.status === 'active' && licensing.licence.status_display !== 'expiring_soon'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                            : licensing.licence.status_display === 'expiring_soon'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                            : licensing.licence.status === 'expired'
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                            : licensing.licence.status === 'pending_renewal'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                            : 'bg-gray-100 dark:bg-gray-700'
                        }>
                          {licensing.licence.status_display === 'expiring_soon' ? 'Expiring Soon' :
                           licensing.licence.status === 'active' ? 'Active' : 
                           licensing.licence.status === 'expired' ? 'Expired' :
                           licensing.licence.status === 'pending_renewal' ? 'Pending Renewal' :
                           licensing.licence.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Licence Key</p>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900 dark:text-white font-mono text-sm">
                              {licensing.licence.licence_key || 'Not set'}
                            </p>
                            {licensing.licence.licence_key && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(licensing.licence.licence_key_full || licensing.licence.licence_key || '');
                                  alert('Licence key copied to clipboard');
                                }}
                                className="h-6 px-2 text-xs"
                              >
                                <Copy className="w-3 h-3 mr-1" />
                                Copy
                              </Button>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Expiration Date</p>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {licensing.licence.expires_at 
                              ? new Date(licensing.licence.expires_at).toLocaleDateString()
                              : 'Not set'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Days Remaining</p>
                          <div className="flex items-center gap-2">
                            <p className={`font-semibold ${
                              (licensing.licence.days_remaining || 0) < 30 
                                ? 'text-red-600 dark:text-red-400' 
                                : (licensing.licence.days_remaining || 0) < 90
                                ? 'text-yellow-600 dark:text-yellow-400'
                                : 'text-gray-900 dark:text-white'
                            }`}>
                              {licensing.licence.days_remaining !== null ? licensing.licence.days_remaining : 'N/A'}
                            </p>
                            {(licensing.licence.days_remaining || 0) < 30 && licensing.licence.days_remaining !== null && (
                              <Clock className="w-4 h-4 text-red-600 dark:text-red-400" />
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Licence Type</p>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {licensing.licence.licence_type || '1 PC / 1 IP / Annual'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Last Validation</p>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            {licensing.licence.last_validated_at 
                              ? new Date(licensing.licence.last_validated_at).toLocaleString()
                              : 'Never'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Subscriber ID</p>
                          <p className="font-semibold text-gray-900 dark:text-white font-mono text-sm">
                            {licensing.licence.subscriber_id || 'Not set'}
                          </p>
                        </div>
                        {licensing.licence.access_level && (
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Access Level</p>
                            <Badge className={
                              licensing.licence.access_level === 'full'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                : licensing.licence.access_level === 'read_only'
                                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                            }>
                              {licensing.licence.access_level === 'full' ? 'Full Access' :
                               licensing.licence.access_level === 'read_only' ? 'Read-Only' :
                               'Blocked'}
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* Renewal Request Section */}
                      {(licensing.licence.status === 'expired' || licensing.licence.status === 'pending_renewal' || (licensing.licence.days_remaining || 0) < 30) && (
                        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-yellow-900 dark:text-yellow-200 flex items-center gap-2">
                              <Key className="w-4 h-4" />
                              Licence Renewal
                            </h4>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const res = await fetch('/api/licensing/renewal-request', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                  });
                                  if (res.ok) {
                                    const data = await res.json();
                                    alert(data.message || 'Renewal request submitted successfully!');
                                    loadLicensingData();
                                  } else {
                                    const error = await res.json();
                                    alert(`Error: ${error.error || 'Failed to request renewal'}`);
                                  }
                                } catch (error: any) {
                                  alert(`Error: ${error.message}`);
                                }
                              }}
                              className="bg-yellow-500 hover:bg-yellow-600 text-white"
                            >
                              <RefreshCw className="w-4 h-4 mr-1" />
                              Request Renewal
                            </Button>
                          </div>
                          {licensing.licence.renewal_code && (
                            <>
                              <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-2">
                                Contact your administrator with this code to renew your licence:
                              </p>
                              <div className="flex items-center gap-2">
                                <code className="px-3 py-2 bg-white dark:bg-gray-800 border border-yellow-300 dark:border-yellow-700 rounded font-mono text-sm text-gray-900 dark:text-white">
                                  {licensing.licence.renewal_code}
                                </code>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    navigator.clipboard.writeText(licensing.licence.renewal_code || '');
                                    alert('Renewal code copied to clipboard');
                                  }}
                                >
                                  <Download className="w-4 h-4 mr-1" />
                                  Copy
                                </Button>
                              </div>
                            </>
                          )}
                          {licensing.licence.renewal_requested_at && (
                            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
                              Renewal requested: {new Date(licensing.licence.renewal_requested_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Device Registration (1 PC) */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Monitor className="w-5 h-5" />
                        Registered Device (1 PC)
                      </h3>
                      <Button
                        onClick={loadLicensingData}
                        variant="outline"
                        size="sm"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                      </Button>
                    </div>

                    {licensing.device?.error === 'UNAUTHORIZED' ? (
                      <div className="text-center py-8">
                        <AlertTriangle className="w-12 h-12 text-yellow-500 dark:text-yellow-400 mx-auto mb-3" />
                        <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">Authentication Required</p>
                        <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                          {licensing.device.message || 'Please refresh the page. Authentication cookies will be set automatically in development mode.'}
                        </p>
                        <Button
                          onClick={() => {
                            window.location.reload();
                          }}
                          className="bg-teal-500 hover:bg-teal-600 text-white"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Refresh Page
                        </Button>
                      </div>
                    ) : licensing.device?.activeDevice ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Device Label</p>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {licensing.device.activeDevice.deviceLabel || 'Primary Device'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Device Type</p>
                              <p className="font-semibold text-gray-900 dark:text-white capitalize">
                                {licensing.device.activeDevice.deviceType}
                              </p>
                            </div>
                            {licensing.device.activeDevice.operatingSystem && (
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Operating System</p>
                                <p className="font-semibold text-gray-900 dark:text-white">
                                  {licensing.device.activeDevice.operatingSystem}
                                </p>
                              </div>
                            )}
                            {licensing.device.activeDevice.browser && (
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Browser</p>
                                <p className="font-semibold text-gray-900 dark:text-white">
                                  {licensing.device.activeDevice.browser}
                                </p>
                              </div>
                            )}
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Registered At</p>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {new Date(licensing.device.activeDevice.registeredAt).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Last Seen</p>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {licensing.device.activeDevice.lastSeenAt 
                                  ? new Date(licensing.device.activeDevice.lastSeenAt).toLocaleString()
                                  : 'Never'}
                              </p>
                            </div>
                          </div>
                          <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Current Device Status</p>
                            {licensing.device.activeDevice.isCurrentDevice ? (
                              <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                This is your registered device
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Different device registered
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={handleDeregisterDevice}
                            variant="outline"
                            className="flex-1"
                            disabled={licensing.licence?.status === 'expired'}
                          >
                            <RefreshCcw className="w-4 h-4 mr-2" />
                            De-register Device
                          </Button>
                          <Button
                            onClick={handleRegisterDevice}
                            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white"
                            disabled={licensing.licence?.status !== 'active'}
                          >
                            <Monitor className="w-4 h-4 mr-2" />
                            Re-register Device
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          De-registering requires admin approval. Re-registering is only available when licence is active.
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Monitor className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-600 dark:text-gray-400 mb-2">No device registered</p>
                        <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                          {licensing.licence?.status === 'active' 
                            ? 'Register this device to enable licence enforcement'
                            : 'Licence must be active to register a device. Please renew your licence first.'}
                        </p>
                        <Button
                          onClick={handleRegisterDevice}
                          className="bg-teal-500 hover:bg-teal-600 text-white"
                          disabled={licensing.licence?.status !== 'active'}
                        >
                          Register This Device
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* IP Address Management */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Globe2 className="w-5 h-5" />
                        Allowed IP Address
                      </h3>
                      <Button
                        onClick={loadLicensingData}
                        variant="outline"
                        size="sm"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                      </Button>
                    </div>

                    {licensing.ip && (
                      <div className="space-y-4">
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Allowed IP</p>
                              <p className="font-semibold text-gray-900 dark:text-white font-mono">
                                {licensing.ip.license?.allowedIp || 'Not set'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Current IP</p>
                              <p className="font-semibold text-gray-900 dark:text-white font-mono">
                                {licensing.ip.current?.ip || 'Unknown'}
                              </p>
                            </div>
                          </div>
                          {licensing.ip.cooldown && !licensing.ip.cooldown.canChange && (
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                                <AlertTriangle className="w-4 h-4 inline mr-2" />
                                IP can only be changed once per 24 hours. {licensing.ip.cooldown.hoursRemaining} hour(s) remaining.
                              </p>
                            </div>
                          )}
                          {/* IP Change Request Status */}
                          {licensing.ip.pendingRequest && (
                            <div className={`p-3 rounded-lg border ${
                              licensing.ip.pendingRequest.status === 'pending'
                                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                                : licensing.ip.pendingRequest.status === 'approved'
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                            }`}>
                              <p className="text-sm font-medium mb-1">
                                {licensing.ip.pendingRequest.status === 'pending' ? '⏳ IP Change Request Pending' :
                                 licensing.ip.pendingRequest.status === 'approved' ? '✅ IP Change Approved' :
                                 '❌ IP Change Rejected'}
                              </p>
                              {licensing.ip.pendingRequest.reason && (
                                <p className="text-xs text-gray-700 dark:text-gray-300">
                                  Reason: {licensing.ip.pendingRequest.reason}
                                </p>
                              )}
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                Requested: {new Date(licensing.ip.pendingRequest.requestedAt).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-3">
                          <Button
                            onClick={() => handleSetIP()}
                            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white"
                            disabled={licensing.ip.cooldown && !licensing.ip.cooldown.canChange || licensing.ip.pendingRequest?.status === 'pending'}
                          >
                            Set to My Current IP
                          </Button>
                          <Button
                            onClick={() => setShowIpRequestModal(true)}
                            variant="outline"
                            className="flex-1"
                            disabled={licensing.ip.cooldown && !licensing.ip.cooldown.canChange || licensing.ip.pendingRequest?.status === 'pending'}
                          >
                            Request IP Change
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Only requests from the allowed IP address will be accepted. IP change requests require admin approval.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* IP Input Modal */}
                  {showIpInput && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                          Enter IP Address
                        </h3>
                        <input
                          type="text"
                          value={customIp}
                          onChange={(e) => setCustomIp(e.target.value)}
                          placeholder="e.g., 192.168.1.1 or 192.168.1.0/24"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && customIp.trim()) {
                              handleSetIP(customIp.trim());
                              setShowIpInput(false);
                              setCustomIp('');
                            } else if (e.key === 'Escape') {
                              setShowIpInput(false);
                              setCustomIp('');
                            }
                          }}
                          autoFocus
                        />
                        <div className="flex gap-3">
                          <Button
                            onClick={() => {
                              if (customIp.trim()) {
                                handleSetIP(customIp.trim());
                                setShowIpInput(false);
                                setCustomIp('');
                              }
                            }}
                            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white"
                            disabled={!customIp.trim()}
                          >
                            Set IP
                          </Button>
                          <Button
                            onClick={() => {
                              setShowIpInput(false);
                              setCustomIp('');
                            }}
                            variant="outline"
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Licence Violation Alerts */}
                  {licensing.violations && licensing.violations.length > 0 && (
                    <div className="border border-red-200 dark:border-red-800 rounded-lg p-6 bg-red-50 dark:bg-red-900/20">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-red-900 dark:text-red-200 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          Licence Violation Alerts
                        </h3>
                        {licensing.licence?.violation_count > 0 && (
                          <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                            {licensing.licence.violation_count} Total
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-red-800 dark:text-red-300 mb-4">
                        Recent violations detected. Please ensure you are using the registered device and IP.
                      </p>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {licensing.violations.map((violation: any, index: number) => (
                          <div key={violation.id || index} className="p-3 bg-white dark:bg-gray-800 rounded border border-red-200 dark:border-red-800 text-sm">
                            <div className="flex items-center justify-between mb-1">
                              <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-xs">
                                {violation.type}
                              </Badge>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(violation.timestamp || violation.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">{violation.reason}</p>
                            {violation.ip_address && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">IP: {violation.ip_address}</p>
                            )}
                          </div>
                        ))}
                      </div>
                      {licensing.licence?.last_violation_at && (
                        <p className="text-xs text-red-700 dark:text-red-300 mt-3">
                          Last violation: {new Date(licensing.licence.last_violation_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Audit Logs */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <History className="w-5 h-5" />
                        Licence Audit Logs
                      </h3>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            // Export as PDF
                            window.open('/api/licensing/export/pdf', '_blank');
                          }}
                          variant="outline"
                          size="sm"
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          PDF
                        </Button>
                        <Button
                          onClick={() => {
                            // Export as CSV
                            window.open('/api/licensing/export/csv', '_blank');
                          }}
                          variant="outline"
                          size="sm"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          CSV
                        </Button>
                        <Button
                          onClick={() => window.open('/api/licensing/audit', '_blank')}
                          variant="outline"
                          size="sm"
                        >
                          View All
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      All licence enforcement actions are logged for security and compliance.
                    </p>
                    {licensing.auditLogs && licensing.auditLogs.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {licensing.auditLogs.map((log: any, index: number) => (
                          <div key={log.id || index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded text-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-gray-900 dark:text-white">{log.action}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(log.createdAt || log.timestamp).toLocaleString()}
                              </span>
                            </div>
                            {log.actorUserId && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">Performed by: {log.actorUserId}</p>
                            )}
                            {log.notes && (
                              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{log.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No audit logs available.</p>
                    )}
                  </div>
                </div>
              )}
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
                    {/* Current Plan Status */}
                    <div className={`bg-gradient-to-r rounded-lg p-6 border ${
                      billingStatus?.plan?.status === 'ACTIVE'
                        ? "from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 border-green-200 dark:border-green-800"
                        : "from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-gray-200 dark:border-gray-600"
                    }`}>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Current Plan</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {billingStatus?.plan?.name || "No active plan"}
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
                          {/* Plan and Purchase Info */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Plan</p>
                              <p className="text-xl font-bold text-gray-900 dark:text-white">{billingStatus?.plan?.name || "—"}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Purchased
                              </p>
                              <p className="text-xl font-bold text-gray-900 dark:text-white">
                                {billingStatus?.plan?.purchasedAt 
                                  ? new Date(billingStatus.plan.purchasedAt).toLocaleDateString()
                                  : "—"}
                              </p>
                            </div>
                          </div>
                          
                          {/* Credit Usage Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 mb-2">
                                <Zap className="w-4 h-4" />
                                Available Balance
                              </p>
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {billingStatus?.credits?.balance?.toLocaleString() || 0}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Credits available to use
                              </p>
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
                              {billingStatus?.credits?.remainingMonthly !== undefined && (
                                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                  <div 
                                    className="bg-green-600 h-2 rounded-full" 
                                    style={{ 
                                      width: `${Math.min(100, (billingStatus.credits.monthlyUsed / (billingStatus.credits.monthlyGrant || 10000)) * 100)}%` 
                                    }}
                                  ></div>
                                </div>
                              )}
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
                              {billingStatus?.credits?.remainingYearly !== undefined && (
                                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                  <div 
                                    className="bg-purple-600 h-2 rounded-full" 
                                    style={{ 
                                      width: `${Math.min(100, (billingStatus.credits.yearlyUsed / (billingStatus.credits.yearlyLimit || 120000)) * 100)}%` 
                                    }}
                                  ></div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-gray-600 dark:text-gray-400 mb-4">No active subscription. Subscribe to Yearly Plan to get started.</p>
                        </div>
                      )}

                      {/* Subscription Status */}
                      {billingStatus?.plan?.status === 'ACTIVE' && (
                        <div className="mb-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Subscription Status</p>
                            <Badge className={
                              billingStatus?.plan?.subscriptionStatus === 'ACTIVE'
                                ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                                : billingStatus?.plan?.subscriptionStatus === 'PAST_DUE'
                                ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                            }>
                              {billingStatus?.plan?.subscriptionStatus || 'INACTIVE'}
                            </Badge>
                          </div>
                          {billingStatus?.plan?.subscriptionStatus === 'PAST_DUE' && (
                            <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                                Payment is past due. Please update your payment method to continue service.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Features */}
                      {billingStatus?.plan?.status === 'ACTIVE' && (
                        <div className="mb-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Included Features:</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                              All Features
                            </Badge>
                            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                              {billingStatus?.plan?.branchesIncluded || 1} Branch
                            </Badge>
                            {billingStatus?.plan?.prioritySupport && (
                              <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                                Priority Support
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Payment Provider Status Warning */}
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
                            disabled={billingLoading || (paymentProviderStatus && !paymentProviderStatus.available)}
                            className="w-full bg-teal-500 hover:bg-teal-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {billingLoading ? 'Processing...' : 'Subscribe Yearly (₹15,000/year)'}
                          </Button>
                        ) : (
                          <Button
                            onClick={handleManageBilling}
                            variant="outline"
                            className="w-full"
                          >
                            Manage Subscription
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Yearly Plan Card (if not subscribed) */}
                    {billingStatus?.plan?.status !== 'ACTIVE' && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-teal-500 p-6">
                        <div className="text-center mb-6">
                          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{YEARLY_PLAN.name}</h3>
                          <div className="flex items-baseline justify-center gap-1">
                            <IndianRupee className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                            <span className="text-4xl font-bold text-gray-900 dark:text-white">{YEARLY_PLAN.yearlyPrice.toLocaleString('en-IN')}</span>
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
                          disabled={billingLoading || (paymentProviderStatus && !paymentProviderStatus.available)}
                          className="w-full bg-teal-500 hover:bg-teal-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {billingLoading ? 'Processing...' : 'Subscribe Yearly'}
                        </Button>
                      </div>
                    )}


                {/* Payment Methods Info */}
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
                              // Payment method chips - click to subscribe (same flow)
                              if (billingStatus?.plan?.status !== 'ACTIVE') {
                                handleSubscribeYearly();
                              }
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

                {/* Billing History */}
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4">Billing History & GST Invoices</h3>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-8 bg-white dark:bg-gray-800">
                    <div className="text-center">
                      <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-600 dark:text-gray-400 mb-2">
                        {billingStatus?.plan?.status === 'ACTIVE' 
                          ? 'No billing history yet'
                          : 'No billing history'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        {billingStatus?.plan?.status === 'ACTIVE'
                          ? 'Your invoices and GST-compliant receipts will appear here once payments are processed'
                          : 'Your billing history and GST invoices will appear here once you purchase a plan'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Indian Market Features Info */}
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
              
              {/* Keyboard Shortcuts Section */}
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
                  <ShortcutsHelpButton 
                    variant="default"
                    size="sm"
                    showIcon={true}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Quick Access</h4>
                    <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <li><kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">{isMacOS ? '⌘' : 'Ctrl'}+K</kbd> Command Palette</li>
                      <li><kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">{isMacOS ? '⌘' : 'Ctrl'}+/</kbd> Show Shortcuts</li>
                      <li><kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Esc</kbd> Close Modals</li>
                    </ul>
                  </div>
                  
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Navigation</h4>
                    <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <li><kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">{isMacOS ? '⌥' : 'Alt'}+1-7</kbd> Navigate to pages</li>
                      <li className="text-xs text-gray-500 dark:text-gray-500 mt-2">Alt+1: Dashboard, Alt+2: POS, etc.</li>
                    </ul>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    <strong>Tip:</strong> Look for shortcut chips on buttons throughout the app. Press {isMacOS ? '⌘' : 'Ctrl'}+/ anytime to see all available shortcuts.
                  </p>
                </div>
              </div>
              <div className="space-y-6">
                {/* Theme Selection */}
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        {resolvedTheme === "dark" ? (
                          <Moon className="w-5 h-5" />
                        ) : (
                          <Sun className="w-5 h-5" />
                        )}
                        Theme
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Choose your preferred theme mode
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setTheme("light")}
                      className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                        theme === "light"
                          ? "bg-teal-50 dark:bg-teal-900/20 border-teal-500 dark:border-teal-400 text-teal-700 dark:text-teal-300"
                          : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                      }`}
                    >
                      <Sun className="w-4 h-4 mx-auto mb-1" />
                      <span className="text-sm font-medium">Light</span>
                    </button>
                    <button
                      onClick={() => setTheme("dark")}
                      className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                        theme === "dark"
                          ? "bg-teal-50 dark:bg-teal-900/20 border-teal-500 dark:border-teal-400 text-teal-700 dark:text-teal-300"
                          : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                      }`}
                    >
                      <Moon className="w-4 h-4 mx-auto mb-1" />
                      <span className="text-sm font-medium">Dark</span>
                    </button>
                    <button
                      onClick={() => setTheme("system")}
                      className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                        theme === "system"
                          ? "bg-teal-50 dark:bg-teal-900/20 border-teal-500 dark:border-teal-400 text-teal-700 dark:text-teal-300"
                          : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                      }`}
                    >
                      <Settings className="w-4 h-4 mx-auto mb-1" />
                      <span className="text-sm font-medium">System</span>
                    </button>
                  </div>
                  {theme === "system" && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                      Following system preference ({resolvedTheme === "dark" ? "Dark" : "Light"})
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

          {/* Save Button - Only show if there are actual settings to save (not for billing, dark mode auto-saves) */}
          {(activeTab === 'profile' || activeTab === 'notifications' || activeTab === 'security' || activeTab === 'licensing') && activeTab !== 'licensing' && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <Button
                onClick={handleSave}
                className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white"
              >
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

