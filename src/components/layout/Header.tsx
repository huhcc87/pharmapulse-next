'use client';

import { Bell, Search } from 'lucide-react';
import { CommandPaletteButton } from '@/components/keyboard-shortcuts/CommandPaletteButton';
import { ShortcutsHelpButton } from '@/components/keyboard-shortcuts/ShortcutsHelpButton';

export default function Header() {
  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Command Palette Button */}
          <CommandPaletteButton 
            variant="ghost" 
            size="sm"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          />
          
          {/* Keyboard Shortcuts Help Button */}
          <ShortcutsHelpButton 
            variant="ghost" 
            size="sm"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          />
          
          <button className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
            <Bell className="w-6 h-6" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">Admin User</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Owner</div>
            </div>
            <div className="w-10 h-10 bg-teal-500 dark:bg-teal-600 rounded-full flex items-center justify-center text-white font-semibold">
              AU
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

