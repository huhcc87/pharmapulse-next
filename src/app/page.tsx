"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white">
      <div className="text-center space-y-4 px-4">
        <h1 className="mb-4 text-4xl font-bold text-blue-600">PharmaPulse AI</h1>
        <p className="text-gray-600 mb-6">India's first AI-powered pharmacy management platform</p>
        <div className="space-y-3">
          <Link 
            href="/pos"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Go to POS
          </Link>
          <div className="flex gap-4 justify-center items-center">
            <Link 
              href="/dashboard"
              className="text-blue-600 hover:underline text-sm"
            >
              Dashboard
            </Link>
            <Link 
              href="/inventory"
              className="text-blue-600 hover:underline text-sm"
            >
              Inventory
            </Link>
            <Link 
              href="/login"
              className="text-blue-600 hover:underline text-sm"
            >
              Sign In
            </Link>
            <Link 
              href="/bedrock-example"
              className="text-blue-600 hover:underline text-sm"
            >
              Bedrock Example
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
