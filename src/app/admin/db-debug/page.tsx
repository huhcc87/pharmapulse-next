// src/app/admin/db-debug/page.tsx
// DB Debug page - shows database connection and schema status

"use client";

import { useState, useEffect } from "react";
import { Database, CheckCircle, XCircle, Copy, RefreshCw, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface DbHealthResponse {
  ok: boolean;
  code?: string;
  error?: string;
  hint?: string;
  db?: {
    provider: string;
    host?: string;
    databaseNameOrPath?: string;
  };
  schema?: {
    customer?: {
      hasEmail: boolean;
    };
  };
}

export default function DbDebugPage() {
  const [health, setHealth] = useState<DbHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchHealth = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/health/db");
      const data = await res.json();
      setHealth(data);
    } catch (error: any) {
      setHealth({
        ok: false,
        code: "FETCH_ERROR",
        error: error.message || "Failed to fetch health status",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const copyFixCommand = () => {
    const command = "npm run db:sync && npm run dev";
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Database className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Database Debug</h1>
          </div>
          <p className="text-gray-600">
            Check database connection and schema synchronization status
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Database Status</h2>
            <button
              onClick={fetchHealth}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : health ? (
            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-3">
                {health.ok ? (
                  <>
                    <CheckCircle className="w-6 h-6 text-green-500" />
                    <span className="text-lg font-semibold text-green-700">
                      Database schema is synchronized
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-6 h-6 text-red-500" />
                    <span className="text-lg font-semibold text-red-700">
                      Database schema out of sync
                    </span>
                  </>
                )}
              </div>

              {/* DB Fingerprint */}
              {health.db && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-700 mb-2">Database Connection</h3>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-gray-600">Provider:</span>{" "}
                      <span className="font-mono font-semibold">{health.db.provider}</span>
                    </div>
                    {health.db.host && (
                      <div>
                        <span className="text-gray-600">Host:</span>{" "}
                        <span className="font-mono">{health.db.host}</span>
                      </div>
                    )}
                    {health.db.databaseNameOrPath && (
                      <div>
                        <span className="text-gray-600">
                          {health.db.provider === "sqlite" ? "File:" : "Database:"}
                        </span>{" "}
                        <span className="font-mono">{health.db.databaseNameOrPath}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Schema Status */}
              {health.schema && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-700 mb-2">Schema Status</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      {health.schema.customer?.hasEmail ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span>
                        Customer.email:{" "}
                        {health.schema.customer?.hasEmail ? "✅ Exists" : "❌ Missing"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Details */}
              {!health.ok && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-red-800 mb-2">Error Details</h3>
                      {health.code && (
                        <div className="text-sm text-red-700 mb-2">
                          <span className="font-semibold">Code:</span> {health.code}
                        </div>
                      )}
                      {health.error && (
                        <div className="text-sm text-red-700 mb-2 font-mono bg-red-100 p-2 rounded">
                          {health.error}
                        </div>
                      )}
                      {health.hint && (
                        <div className="mt-4">
                          <div className="text-sm font-semibold text-red-800 mb-2">
                            Fix Instructions:
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-red-100 text-red-900 px-3 py-2 rounded font-mono text-sm">
                              {health.hint}
                            </code>
                            <button
                              onClick={copyFixCommand}
                              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              <Copy className="w-4 h-4" />
                              {copied ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Success Message */}
              {health.ok && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-green-800 mb-1">
                        All checks passed!
                      </h3>
                      <p className="text-sm text-green-700">
                        Your database schema is synchronized with Prisma schema. Customer creation
                        should work correctly.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-red-500">
              Failed to fetch database status
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <Link
              href="/pos"
              className="block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center"
            >
              Go to POS Terminal
            </Link>
            {!health?.ok && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> Run the fix command in your terminal, then restart
                  your dev server before creating customers.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


