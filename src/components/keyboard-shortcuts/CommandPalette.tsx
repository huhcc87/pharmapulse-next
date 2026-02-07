/**
 * Command Palette Component
 * 
 * Modal command palette accessible via mod+K
 * Provides quick navigation and action execution
 */

'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, X, LayoutDashboard, ShoppingCart, Package, Brain, Pill, FileText, Settings, ArrowRight, Zap } from 'lucide-react';
import { CommandPaletteItem } from '@/lib/keyboard-shortcuts/types';
import { formatShortcutDisplay, isMac } from '@/lib/keyboard-shortcuts/platform';
import { useShortcut } from '@/hooks/useShortcut';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [modKey, setModKey] = useState<string>('Ctrl'); // Default to avoid hydration mismatch
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Set mod key on client side only to avoid hydration mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setModKey(isMac() ? '⌘' : 'Ctrl');
    }
  }, []);

  // Navigation commands
  const navigationItems: CommandPaletteItem[] = [
    {
      id: 'nav-dashboard',
      label: 'Dashboard',
      description: 'Go to dashboard',
      category: 'navigation',
      icon: 'dashboard',
      action: () => {
        router.push('/dashboard');
        onClose();
      },
    },
    {
      id: 'nav-pos',
      label: 'POS Terminal',
      description: 'Open point of sale',
      category: 'navigation',
      icon: 'pos',
      action: () => {
        router.push('/pos');
        onClose();
      },
    },
    {
      id: 'nav-inventory',
      label: 'Inventory',
      description: 'Manage inventory',
      category: 'navigation',
      icon: 'inventory',
      action: () => {
        router.push('/inventory');
        onClose();
      },
    },
    {
      id: 'nav-prescription-ai',
      label: 'Prescription AI',
      description: 'AI-powered prescription analysis',
      category: 'navigation',
      icon: 'ai',
      action: () => {
        router.push('/prescription-ai');
        onClose();
      },
    },
    {
      id: 'nav-adherence',
      label: 'Adherence',
      description: 'Patient adherence tracking',
      category: 'navigation',
      icon: 'adherence',
      action: () => {
        router.push('/adherence');
        onClose();
      },
    },
    {
      id: 'nav-reports',
      label: 'Reports',
      description: 'View reports and analytics',
      category: 'navigation',
      icon: 'reports',
      action: () => {
        router.push('/reports');
        onClose();
      },
    },
    {
      id: 'nav-settings',
      label: 'Settings',
      description: 'Application settings',
      category: 'navigation',
      icon: 'settings',
      action: () => {
        router.push('/settings');
        onClose();
      },
    },
  ];

  // POS actions (only on /pos route)
  const posItems: CommandPaletteItem[] = [
    {
      id: 'pos-focus-scan',
      label: 'Focus Scan Input',
      description: 'Focus barcode scanner input',
      shortcut: 'F2',
      category: 'action',
      icon: 'scan',
      action: () => {
        const input = document.querySelector('[data-pos-scan-input]') as HTMLInputElement;
        input?.focus();
        onClose();
      },
    },
    {
      id: 'pos-new-sale',
      label: 'New Sale',
      description: 'Start a new sale',
      shortcut: 'mod+n',
      category: 'action',
      icon: 'new',
      action: () => {
        // Trigger new sale (will be handled by POS page)
        window.dispatchEvent(new CustomEvent('pos:new-sale'));
        onClose();
      },
    },
    {
      id: 'pos-hold-cart',
      label: 'Hold Cart',
      description: 'Hold current cart',
      shortcut: 'mod+h',
      category: 'action',
      icon: 'hold',
      action: () => {
        window.dispatchEvent(new CustomEvent('pos:hold-cart'));
        onClose();
      },
    },
    {
      id: 'pos-resume-cart',
      label: 'Resume Cart',
      description: 'Resume held cart',
      shortcut: 'mod+r',
      category: 'action',
      icon: 'resume',
      action: () => {
        window.dispatchEvent(new CustomEvent('pos:resume-cart'));
        onClose();
      },
    },
    {
      id: 'pos-payment',
      label: 'Open Payment Modal',
      description: 'Open payment dialog',
      shortcut: 'shift+mod+p',
      category: 'action',
      icon: 'payment',
      action: () => {
        window.dispatchEvent(new CustomEvent('pos:open-payment'));
        onClose();
      },
    },
    {
      id: 'pos-discount',
      label: 'Apply Discount',
      description: 'Open discount modal',
      shortcut: 'mod+d',
      category: 'action',
      icon: 'discount',
      action: () => {
        window.dispatchEvent(new CustomEvent('pos:open-discount'));
        onClose();
      },
    },
    {
      id: 'pos-print',
      label: 'Print Last Invoice',
      description: 'Print or preview last invoice',
      shortcut: 'mod+p',
      category: 'action',
      icon: 'print',
      action: () => {
        window.dispatchEvent(new CustomEvent('pos:print-invoice'));
        onClose();
      },
    },
  ];

  // Inventory actions (only on /inventory route)
  const inventoryItems: CommandPaletteItem[] = [
    {
      id: 'inv-focus-scan',
      label: 'Focus Scan Input',
      description: 'Focus barcode scanner input',
      shortcut: 'F2',
      category: 'action',
      icon: 'scan',
      action: () => {
        const input = document.querySelector('[data-inv-scan-input]') as HTMLInputElement;
        input?.focus();
        onClose();
      },
    },
    {
      id: 'inv-add-product',
      label: 'Add New Product',
      description: 'Open add product modal',
      shortcut: 'mod+a',
      category: 'action',
      icon: 'add',
      action: () => {
        window.dispatchEvent(new CustomEvent('inventory:add-product'));
        onClose();
      },
    },
    {
      id: 'inv-drug-library',
      label: 'Open Drug Library',
      description: 'Open drug library modal',
      shortcut: 'mod+l',
      category: 'action',
      icon: 'library',
      action: () => {
        window.dispatchEvent(new CustomEvent('inventory:open-drug-library'));
        onClose();
      },
    },
  ];

  // Combine all items based on current route
  const allItems = useMemo(() => {
    const items: CommandPaletteItem[] = [...navigationItems];
    
    if (pathname.startsWith('/pos')) {
      items.push(...posItems);
    }
    
    if (pathname.startsWith('/inventory')) {
      items.push(...inventoryItems);
    }
    
    return items;
  }, [pathname]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!search.trim()) {
      return allItems;
    }
    
    const query = search.toLowerCase();
    return allItems.filter(item => 
      item.label.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  }, [allItems, search]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search, filteredItems.length]);

  // Register keyboard shortcuts
  useShortcut({
    id: 'command-palette-close',
    keys: ['escape'],
    action: onClose,
    description: 'Close command palette',
    category: 'modal',
    allowInInput: true,
  });

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const getIcon = (icon?: string) => {
    switch (icon) {
      case 'dashboard': return <LayoutDashboard className="w-4 h-4" />;
      case 'pos': return <ShoppingCart className="w-4 h-4" />;
      case 'inventory': return <Package className="w-4 h-4" />;
      case 'ai': return <Brain className="w-4 h-4" />;
      case 'adherence': return <Pill className="w-4 h-4" />;
      case 'reports': return <FileText className="w-4 h-4" />;
      case 'settings': return <Settings className="w-4 h-4" />;
      case 'scan': return <Search className="w-4 h-4" />;
      case 'new': return <Zap className="w-4 h-4" />;
      case 'payment': return <ShoppingCart className="w-4 h-4" />;
      case 'discount': return <FileText className="w-4 h-4" />;
      case 'hold': return <FileText className="w-4 h-4" />;
      case 'resume': return <FileText className="w-4 h-4" />;
      case 'print': return <FileText className="w-4 h-4" />;
      case 'add': return <Package className="w-4 h-4" />;
      case 'library': return <FileText className="w-4 h-4" />;
      default: return <ArrowRight className="w-4 h-4" />;
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-20 px-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Type to search commands... (Press ${modKey}+K to open)`}
            className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Items List */}
        <div 
          ref={listRef}
          className="flex-1 overflow-y-auto p-2"
        >
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No commands found
            </div>
          ) : (
            filteredItems.map((item, index) => (
              <button
                key={item.id}
                onClick={() => item.action()}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  index === selectedIndex
                    ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-900 dark:text-teal-100'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="text-gray-400 dark:text-gray-500">
                  {getIcon(item.icon)}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{item.label}</div>
                  {item.description && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {item.description}
                    </div>
                  )}
                </div>
                {item.shortcut && (
                  <Badge 
                    variant="outline" 
                    className="text-xs font-mono bg-gray-100 dark:bg-gray-700"
                  >
                    {formatShortcutDisplay(item.shortcut.split('+'))}
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
            <span className="hidden sm:inline">{modKey}+K to open</span>
          </div>
          <span>{filteredItems.length} command{filteredItems.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}
