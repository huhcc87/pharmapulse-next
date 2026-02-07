/**
 * Keyboard Shortcuts Provider
 * 
 * Central context provider for keyboard shortcuts across the application
 */

'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { ShortcutConfig } from './types';
import { matchesShortcut, isMac } from './platform';
import { isTypingInInput, shouldAllowInInput } from './utils';

interface ShortcutContextValue {
  registerShortcut: (config: ShortcutConfig) => () => void;
  unregisterShortcut: (id: string) => void;
  shortcuts: ShortcutConfig[];
}

const ShortcutContext = createContext<ShortcutContextValue | undefined>(undefined);

export function useShortcuts(): ShortcutContextValue {
  const context = useContext(ShortcutContext);
  if (!context) {
    throw new Error('useShortcuts must be used within ShortcutProvider');
  }
  return context;
}

interface ShortcutProviderProps {
  children: React.ReactNode;
}

export function ShortcutProvider({ children }: ShortcutProviderProps) {
  const [shortcuts, setShortcuts] = useState<ShortcutConfig[]>([]);
  const shortcutsRef = useRef<ShortcutConfig[]>([]);
  const pathname = usePathname();
  const isMacOS = isMac();

  // Keep ref in sync with state
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const registerShortcut = useCallback((config: ShortcutConfig) => {
    setShortcuts(prev => {
      // Remove existing shortcut with same ID
      const filtered = prev.filter(s => s.id !== config.id);
      return [...filtered, config];
    });

    // Return unregister function
    return () => {
      setShortcuts(prev => prev.filter(s => s.id !== config.id));
    };
  }, []);

  const unregisterShortcut = useCallback((id: string) => {
    setShortcuts(prev => prev.filter(s => s.id !== id));
  }, []);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Get current active shortcuts
      const activeShortcuts = shortcutsRef.current.filter(shortcut => {
        // Check route restriction
        if (shortcut.route && pathname !== shortcut.route) {
          return false;
        }

        // Check category-based route restrictions
        if (shortcut.category === 'pos' && !pathname.startsWith('/pos')) {
          return false;
        }
        if (shortcut.category === 'inventory' && !pathname.startsWith('/inventory')) {
          return false;
        }

        return true;
      });

      // Check if user is typing
      const typing = isTypingInInput(event.target);
      const allowInInput = activeShortcuts.some(s => shouldAllowInInput(s.keys));

      // Block shortcuts if typing (except explicitly allowed ones)
      if (typing && !allowInInput) {
        // Check if the current shortcut is allowed in input
        const currentShortcut = activeShortcuts.find(s => matchesShortcut(event, s.keys));
        if (!currentShortcut || !shouldAllowInInput(currentShortcut.keys)) {
          return;
        }
      }

      // Find matching shortcut
      const matchingShortcut = activeShortcuts.find(s => matchesShortcut(event, s.keys));

      if (matchingShortcut) {
        // Prevent default if configured
        if (matchingShortcut.preventDefault !== false) {
          event.preventDefault();
          event.stopPropagation();
        }

        // Execute action
        try {
          matchingShortcut.action();
        } catch (error) {
          console.error('Error executing shortcut:', matchingShortcut.id, error);
        }
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pathname]);

  const value: ShortcutContextValue = {
    registerShortcut,
    unregisterShortcut,
    shortcuts,
  };

  return (
    <ShortcutContext.Provider value={value}>
      {children}
    </ShortcutContext.Provider>
  );
}
