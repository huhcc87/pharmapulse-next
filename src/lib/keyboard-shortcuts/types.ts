/**
 * Keyboard Shortcuts System - Types
 * 
 * Centralized types for keyboard shortcuts across PharmaPulse
 */

export interface ShortcutConfig {
  id: string;
  keys: string[]; // e.g., ['mod', 'k'] or ['f2']
  action: () => void;
  description: string;
  category: 'global' | 'pos' | 'inventory' | 'modal';
  route?: string; // Optional: only active on specific route
  preventDefault?: boolean;
  allowInInput?: boolean; // Allow even when typing (Esc, mod+K, mod+/)
}

export interface ShortcutBinding {
  id: string;
  keys: string[];
  keysDisplay: string; // Platform-specific display (e.g., "⌘K" or "Ctrl+K")
  action: () => void;
  description: string;
  category: string;
}

export interface CommandPaletteItem {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  category: 'navigation' | 'action' | 'search';
  action: () => void;
  icon?: string;
}
