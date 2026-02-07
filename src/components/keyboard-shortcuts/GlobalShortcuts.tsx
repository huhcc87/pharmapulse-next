/**
 * Global Shortcuts Manager
 * 
 * Manages global shortcuts (command palette, help overlay, navigation)
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CommandPalette } from './CommandPalette';
import { ShortcutsHelpOverlay } from './ShortcutsHelpOverlay';
import { useShortcuts } from '@/lib/keyboard-shortcuts/ShortcutProvider';
import { getGlobalShortcuts } from '@/lib/keyboard-shortcuts/shortcuts';
import { useEffect } from 'react';

export function GlobalShortcuts() {
  const router = useRouter();
  const { registerShortcut, unregisterShortcut } = useShortcuts();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  // Register global shortcuts
  useEffect(() => {
    const unregisterFns = getGlobalShortcuts(
      () => setCommandPaletteOpen(true),
      () => setShortcutsHelpOpen(true),
      (path) => router.push(path)
    ).map(config => registerShortcut(config));

    return () => {
      unregisterFns.forEach(fn => fn());
    };
  }, [registerShortcut, router]);

  return (
    <>
      <CommandPalette 
        isOpen={commandPaletteOpen} 
        onClose={() => setCommandPaletteOpen(false)} 
      />
      <ShortcutsHelpOverlay 
        isOpen={shortcutsHelpOpen} 
        onClose={() => setShortcutsHelpOpen(false)} 
      />
    </>
  );
}
