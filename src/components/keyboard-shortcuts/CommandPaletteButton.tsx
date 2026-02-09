/**
 * Command Palette Button
 *
 * Button to open command palette
 * Can be placed in header, sidebar, or anywhere in the app
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { CommandPalette } from './CommandPalette';
import { Button } from '@/components/ui/button';
import { ShortcutChip } from './ShortcutChip';
import { useShortcut } from '@/hooks/useShortcut';
import { isMac } from '@/lib/keyboard-shortcuts/platform';

type ButtonVariant = 'default' | 'outline' | 'ghost';
// shadcn Button sizes commonly: 'default' | 'sm' | 'lg' | 'icon'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

// Allow legacy "md" from older code, but normalize it safely.
type LegacySize = ButtonSize | 'md';

interface CommandPaletteButtonProps {
  variant?: ButtonVariant;
  size?: LegacySize;
  showChip?: boolean;
  className?: string;
}

export function CommandPaletteButton({
  variant = 'ghost',
  size = 'sm',
  showChip = false,
  className = '',
}: CommandPaletteButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [modKey, setModKey] = useState<string>('Ctrl'); // Default to avoid hydration mismatch

  // Normalize legacy size -> shadcn Button size
  const normalizedSize: ButtonSize = size === 'md' ? 'default' : size;

  // Set mod key on client side only to avoid hydration mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setModKey(isMac() ? '⌘' : 'Ctrl');
    }
  }, []);

  // Register shortcut to open command palette
  useShortcut({
    id: 'open-command-palette-button',
    keys: ['mod', 'k'],
    action: () => setIsOpen(true),
    description: 'Open command palette',
    category: 'global',
    allowInInput: true,
  });

  return (
    <>
      <Button
        variant={variant}
        size={normalizedSize}
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 ${className}`}
        title={`Command Palette (${modKey}+K)`}
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Commands</span>
        {showChip && <ShortcutChip shortcut="mod+k" className="ml-1" />}
      </Button>

      <CommandPalette isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
