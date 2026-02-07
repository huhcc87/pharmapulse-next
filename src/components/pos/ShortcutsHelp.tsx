"use client";

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";

export default function ShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  const shortcuts = [
    { key: "F2", description: "Focus search input / Open Drug Library" },
    { key: "F3", description: "Open Select Customer" },
    { key: "F4", description: "Trigger Checkout" },
    { key: "Ctrl+K / ⌘K", description: "Focus search input" },
    { key: "Esc", description: "Close modal / Clear search" },
    { key: "Enter", description: "Add highlighted suggestion to cart" },
    { key: "↑/↓", description: "Navigate search suggestions" },
    { key: "Ctrl+R / ⌘R", description: "Repeat Last Invoice" },
    { key: "Shift+?", description: "Show this help" },
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 p-3 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors z-40"
        title="Keyboard Shortcuts (Shift+?)"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Keyboard Shortcuts</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              {shortcuts.map((shortcut, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b">
                  <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                    {shortcut.key}
                  </kbd>
                  <span className="text-sm text-gray-600">{shortcut.description}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
