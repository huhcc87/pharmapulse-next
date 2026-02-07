'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Brain, 
  Pill, 
  BarChart3, 
  FileText, 
  Smartphone, 
  Users, 
  Settings,
  Keyboard
} from 'lucide-react';
import { ShortcutsHelpButton } from '@/components/keyboard-shortcuts/ShortcutsHelpButton';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', permission: null },
  { icon: ShoppingCart, label: 'POS Terminal', href: '/pos', permission: null },
  { icon: Package, label: 'Inventory', href: '/inventory', permission: null },
  { icon: Brain, label: 'Prescription AI', href: '/prescription-ai', permission: null },
  { icon: Pill, label: 'Adherence', href: '/adherence', permission: null },
  { icon: BarChart3, label: 'Analytics', href: '/analytics', permission: 'ANALYTICS_VIEW' },
  { icon: FileText, label: 'Reports', href: '/reports', permission: null },
  { icon: Smartphone, label: 'Mobile App', href: '/mobile', permission: null },
  { icon: Users, label: 'Users', href: '/users', permission: null },
  { icon: Settings, label: 'Settings', href: '/settings', permission: null },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [userPermissions, setUserPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      try {
        const res = await fetch('/api/security/rbac', {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const perms = new Set(data.permissions || []);
          // Owner has all permissions
          if (data.roles?.includes('OWNER')) {
            perms.add('ANALYTICS_VIEW');
          }
          setUserPermissions(perms);
        } else {
          // Non-200 response is fine - continue with empty permissions
          if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            console.debug('[Sidebar] Permissions API returned non-200, continuing with default permissions', {
              status: res.status,
            });
          }
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name !== 'AbortError') {
          // Only log non-timeout errors in dev
          if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            console.debug('[Sidebar] Permissions check error (non-fatal):', fetchError);
          }
        } else {
          // Timeout is fine, just continue with empty permissions
          if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            console.debug('[Sidebar] Permissions check timed out, continuing with default permissions');
          }
        }
      }
    } catch (error) {
      // Silently fail - don't block the UI if permissions check fails
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        console.debug('[Sidebar] Failed to check permissions (non-fatal):', error);
      }
    } finally {
      // ALWAYS set loading to false - critical for preventing infinite loading
      setLoading(false);
    }
  };

  // Filter menu items based on permissions
  const visibleMenuItems = menuItems.filter(item => {
    if (!item.permission) return true; // No permission required
    return userPermissions.has(item.permission);
  });

  return (
    <div className="w-64 bg-gray-900 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center">
            <Pill className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xl font-bold">PharmaPulse</span>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-800">
        <input
          type="text"
          placeholder="Search..."
          className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-teal-500"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {loading ? (
          <div className="text-gray-400 text-sm px-4 py-2">Loading...</div>
        ) : (
          visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-teal-500 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })
        )}
      </nav>

      {/* Keyboard Shortcuts Help Button */}
      <div className="p-4 border-t border-gray-800">
        <ShortcutsHelpButton 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
        />
      </div>
    </div>
  );
}

