'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPWAInstaller } from '@/lib/pwa/pwa-installer';

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const installer = getPWAInstaller();
    
    // Check if already installed
    if (installer.isInstalled()) {
      setIsInstalled(true);
      return;
    }

    // Listen for install availability
    installer.onInstallAvailable(() => {
      setShowPrompt(true);
    });

    // Check if installable
    if (installer.isInstallable()) {
      setShowPrompt(true);
    }
  }, []);

  const handleInstall = async () => {
    const installer = getPWAInstaller();
    const success = await installer.promptInstall();
    
    if (success) {
      setShowPrompt(false);
      setIsInstalled(true);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Store dismissal in localStorage to avoid showing again for 7 days
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Check if dismissed recently
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        setShowPrompt(false);
      }
    }
  }, []);

  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-teal-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Install PharmaPulse
          </h3>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Install our app for a better experience. Works offline and sends notifications for orders, stock alerts, and more.
      </p>
      <div className="flex gap-2">
        <Button
          onClick={handleInstall}
          className="flex-1 bg-teal-500 hover:bg-teal-600 text-white"
        >
          Install App
        </Button>
        <Button
          onClick={handleDismiss}
          variant="outline"
          className="flex-1"
        >
          Not Now
        </Button>
      </div>
    </div>
  );
}
