// PWA Installation and Management
// Handles "Add to Home Screen" functionality and PWA lifecycle

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export class PWAInstaller {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private installHandlers: Array<() => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupEventListeners();
    }
  }

  private setupEventListeners() {
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.notifyInstallAvailable();
    });

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.notifyInstallComplete();
    });
  }

  /**
   * Check if app is already installed
   */
  isInstalled(): boolean {
    if (typeof window === 'undefined') return false;
    
    // Check if running in standalone mode (installed)
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
  }

  /**
   * Check if installation is available
   */
  isInstallable(): boolean {
    return this.deferredPrompt !== null;
  }

  /**
   * Show install prompt
   */
  async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    try {
      await this.deferredPrompt.prompt();
      const choiceResult = await this.deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        this.deferredPrompt = null;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error showing install prompt:', error);
      return false;
    }
  }

  /**
   * Register install available handler
   */
  onInstallAvailable(handler: () => void) {
    this.installHandlers.push(handler);
  }

  private notifyInstallAvailable() {
    this.installHandlers.forEach(handler => handler());
  }

  private notifyInstallComplete() {
    // Can be extended to notify installation complete
  }
}

// Singleton instance
let pwaInstallerInstance: PWAInstaller | null = null;

export function getPWAInstaller(): PWAInstaller {
  if (!pwaInstallerInstance) {
    pwaInstallerInstance = new PWAInstaller();
  }
  return pwaInstallerInstance;
}
