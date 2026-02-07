"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WifiOff, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export default function OfflinePage() {
  const router = useRouter();

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md border-border/50 shadow-lg">
        <CardHeader className="text-center">
          <WifiOff className="mx-auto mb-2 h-12 w-12 text-gray-400" />
          <CardTitle className="text-xl">You're Offline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-gray-600">
            It looks like you've lost your internet connection. Some features may be unavailable until you reconnect.
          </p>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              PharmaPulse AI works offline with limited functionality. You can still access:
            </p>
            <ul className="list-inside list-disc text-left text-sm text-gray-500">
              <li>Cached inventory data</li>
              <li>Recent transactions</li>
              <li>Local product database</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button 
              onClick={handleRefresh}
              className="flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Button 
              variant="outline" 
              onClick={() => router.push("/dashboard")}
            >
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
