/**
 * useShortcut Hook
 * 
 * Hook to register a keyboard shortcut
 */

import { useEffect, useRef } from 'react';
import { useShortcuts } from '@/lib/keyboard-shortcuts/ShortcutProvider';
import { ShortcutConfig } from '@/lib/keyboard-shortcuts/types';

/**
 * Register a keyboard shortcut
 * 
 * @example
 * useShortcut({
 *   id: 'open-command-palette',
 *   keys: ['mod', 'k'],
 *   action: () => setOpen(true),
 *   description: 'Open command palette',
 *   category: 'global',
 * });
 */
export function useShortcut(config: ShortcutConfig) {
  const { registerShortcut, unregisterShortcut } = useShortcuts();
  const configRef = useRef(config);

  // Update ref when config changes
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    const unregister = registerShortcut({
      ...configRef.current,
      action: () => {
        configRef.current.action();
      },
    });

    return () => {
      unregister();
    };
  }, [registerShortcut, unregisterShortcut]);
}
