/**
 * Keyboard Shortcuts Help Overlay
 * 
 * Modal displaying all available keyboard shortcuts
 * Accessible via mod+/
 */

'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { formatShortcutDisplay, getModKeyLabel, getAltKeyLabel, isMac } from '@/lib/keyboard-shortcuts/platform';
import { parseShortcutString } from '@/lib/keyboard-shortcuts/utils';
import { useShortcut } from '@/hooks/useShortcut';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ShortcutsHelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: {
    keys: string;
    description: string;
  }[];
}

export function ShortcutsHelpOverlay({ isOpen, onClose }: ShortcutsHelpOverlayProps) {
  const [modLabel, setModLabel] = useState<string>('Ctrl'); // Default to avoid hydration mismatch
  const [altLabel, setAltLabel] = useState<string>('Alt'); // Default to avoid hydration mismatch
  const [isMacOS, setIsMacOS] = useState<boolean>(false);

  // Set labels on client side only to avoid hydration mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setModLabel(getModKeyLabel());
      setAltLabel(getAltKeyLabel());
      setIsMacOS(isMac());
    }
  }, []);

  const shortcutGroups: ShortcutGroup[] = [
    {
      title: 'Global',
      shortcuts: [
        { keys: 'mod+k', description: 'Open command palette' },
        { keys: 'mod+/', description: 'Show keyboard shortcuts' },
        { keys: 'escape', description: 'Close modal/drawer/popover' },
        { keys: 'alt+1', description: 'Navigate to Dashboard' },
        { keys: 'alt+2', description: 'Navigate to POS' },
        { keys: 'alt+3', description: 'Navigate to Inventory' },
        { keys: 'alt+4', description: 'Navigate to Prescription AI' },
        { keys: 'alt+5', description: 'Navigate to Adherence' },
        { keys: 'alt+6', description: 'Navigate to Reports' },
        { keys: 'alt+7', description: 'Navigate to Settings' },
      ],
    },
    {
      title: 'POS',
      shortcuts: [
        { keys: 'f2', description: 'Focus barcode scan input' },
        { keys: 'enter', description: 'Add scanned item' },
        { keys: '+', description: 'Increase quantity for selected cart line' },
        { keys: '-', description: 'Decrease quantity for selected cart line' },
        { keys: 'delete', description: 'Remove selected cart line' },
        { keys: 'shift+mod+p', description: 'Open payment modal' },
        { keys: 'mod+d', description: 'Open discount modal' },
        { keys: 'mod+h', description: 'Hold cart' },
        { keys: 'mod+r', description: 'Resume cart' },
        { keys: 'mod+n', description: 'New sale (clear cart)' },
        { keys: 'mod+p', description: 'Print last invoice' },
      ],
    },
    {
      title: 'Inventory',
      shortcuts: [
        { keys: 'f2', description: 'Focus scan input' },
        { keys: 'mod+a', description: 'Open Add New Product modal' },
        { keys: 'mod+l', description: 'Open Drug Library modal' },
      ],
    },
    {
      title: 'Add New Product Modal',
      shortcuts: [
        { keys: 'mod+s', description: 'Save/Add Product' },
        { keys: 'shift+mod+r', description: 'Research from Web' },
        { keys: 'shift+mod+l', description: 'Lookup Product' },
        { keys: 'mod+v', description: 'Verify (set verified status)' },
        { keys: 'escape', description: 'Close modal' },
      ],
    },
  ];

  useShortcut({
    id: 'shortcuts-help-close',
    keys: ['escape'],
    action: onClose,
    description: 'Close shortcuts help',
    category: 'modal',
    allowInInput: true,
  });

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Keyboard Shortcuts
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              <strong>mod</strong> = {modLabel === '⌘' ? '⌘ Command (Mac) / Ctrl (Windows)' : 'Ctrl (Windows) / ⌘ Command (Mac)'}, <strong>alt</strong> = {altLabel === '⌥' ? '⌥ Option (Mac) / Alt (Windows)' : 'Alt (Windows) / ⌥ Option (Mac)'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Shortcuts automatically adapt to your platform. Windows users see Ctrl, Mac users see ⌘.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-8">
            {shortcutGroups.map((group) => (
              <div key={group.title}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {group.title}
                </h3>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut, index) => {
                    const keys = parseShortcutString(shortcut.keys);
                    const display = formatShortcutDisplay(keys);

                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {shortcut.description}
                        </span>
                        <Badge 
                          variant="outline" 
                          className="font-mono text-xs bg-gray-100 dark:bg-gray-700 min-w-[80px] text-center"
                        >
                          {display}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
