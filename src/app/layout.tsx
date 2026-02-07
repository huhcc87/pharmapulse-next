import { SubscriptionProvider } from "@/components/billing/SubscriptionProvider";
import { RenewModal } from "@/components/billing/RenewModal";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ShortcutProvider } from "@/lib/keyboard-shortcuts/ShortcutProvider";
import { GlobalShortcuts } from "@/components/keyboard-shortcuts/GlobalShortcuts";
import AppLayoutClient from "@/components/layout/AppLayout";
import { SchemaWarningBanner } from "@/components/admin/SchemaWarningBanner";
import PWARegistration from "@/components/pwa/PWARegistration";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <PWARegistration />
        <ThemeProvider>
          <ShortcutProvider>
            <SubscriptionProvider>
              <RenewModal />
              <SchemaWarningBanner />
              <GlobalShortcuts />
              <AppLayoutClient>
                {children}
              </AppLayoutClient>
            </SubscriptionProvider>
          </ShortcutProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
