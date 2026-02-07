// src/components/pos/CustomerDrawer.tsx
"use client";

import { useState, useEffect } from "react";
import { X, User, Phone, Mail, Calendar, AlertTriangle, Gift, History } from "lucide-react";
import type { CustomerDTO } from "@/lib/types/pos";

interface CustomerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: CustomerDTO) => void;
  selectedCustomerId?: number | null;
}

export default function CustomerDrawer({
  isOpen,
  onClose,
  onSelect,
  selectedCustomerId,
}: CustomerDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    dob: "",
    allergies: [] as string[],
    notes: "",
  });

  useEffect(() => {
    if (isOpen && searchQuery.length >= 2) {
      handleSearch();
    } else if (isOpen && searchQuery.length === 0) {
      setCustomers([]);
    }
  }, [searchQuery, isOpen]);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomer(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch (error) {
      console.error("Customer search error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomer = async (id: number) => {
    try {
      const res = await fetch(`/api/customers/${id}`);
      const data = await res.json();
      setSelectedCustomer(data.customer);
    } catch (error) {
      console.error("Customer fetch error:", error);
    }
  };

  const showToast = (message: string, type: "success" | "error" = "success") => {
    const toast = document.createElement("div");
    toast.className = `fixed top-20 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
      type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  const handleCreateCustomer = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    // Validate name
    if (!newCustomer.name || newCustomer.name.trim().length < 2) {
      showToast("Name must be at least 2 characters", "error");
      return;
    }

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustomer.name,
          phone: newCustomer.phone || null,
          email: newCustomer.email || null,
        }),
      });

      const data = await res.json();

      if (data.ok && data.customer) {
        // Success: select customer, close form, refresh list
        const createdCustomer: CustomerDTO = {
          id: data.customer.id,
          name: data.customer.name,
          phone: data.customer.phone,
          email: data.customer.email,
          dob: null,
          allergies: data.customer.allergies || [],
          notes: null,
          gstin: null,
          stateCode: null,
          loyaltyPoints: data.customer.loyaltyPoints || 0,
          createdAt: data.customer.createdAt,
          updatedAt: data.customer.createdAt,
        };

        setSelectedCustomer(createdCustomer);
        onSelect(createdCustomer);
        setShowCreateForm(false);
        setNewCustomer({ name: "", phone: "", email: "", dob: "", allergies: [], notes: "" });
        
        // Refresh customer list
        if (searchQuery.length >= 2) {
          handleSearch();
        }

        showToast("Customer created & selected", "success");
      } else {
        // Error from server
        const errorMsg = data.error || "Failed to create customer";
        
        // Handle DB_SCHEMA_OUT_OF_SYNC error with clear instructions
        if (data.code === "DB_SCHEMA_OUT_OF_SYNC") {
          const fixHint = data.hint || "Run: npm run db:sync && restart dev server";
          
          // Show persistent banner instead of toast
          const banner = document.createElement("div");
          banner.className = "fixed top-0 left-0 right-0 bg-red-600 text-white px-6 py-4 z-50 shadow-lg";
          banner.innerHTML = `
            <div class="max-w-7xl mx-auto flex items-center justify-between">
              <div class="flex items-center gap-3">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <div class="font-semibold">Database schema out of sync</div>
                  <div class="text-sm text-red-100">${fixHint}</div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button onclick="this.parentElement.parentElement.parentElement.remove()" class="px-4 py-2 bg-red-700 hover:bg-red-800 rounded text-sm">
                  Dismiss
                </button>
              </div>
            </div>
          `;
          document.body.appendChild(banner);
          
          // Log detailed fix instructions
          if (data.detailedFix) {
            console.error("🔧 Database Schema Fix Required:");
            data.detailedFix.forEach((step: string) => console.error(`  ${step}`));
          }
          
          // Disable create button
          const createBtn = document.querySelector('button[type="submit"]');
          if (createBtn) {
            (createBtn as HTMLButtonElement).disabled = true;
            (createBtn as HTMLButtonElement).textContent = "Fix Schema First";
          }
          
          // Don't retry - user needs to fix schema first
          return;
        }
        
        // Other errors
        showToast(errorMsg, "error");
      }
    } catch (error: any) {
      console.error("Customer creation error:", error);
      showToast(error.message || "Failed to create customer", "error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
      <div className="bg-white rounded-t-lg w-full max-w-md mx-auto max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Customer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          {/* Create New */}
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full mb-4 px-4 py-2 border-2 border-dashed rounded-lg text-gray-600 hover:bg-gray-50"
            >
              + Create New Customer
            </button>
          ) : (
            <form onSubmit={handleCreateCustomer} className="mb-4 p-4 border rounded-lg space-y-3">
              <h3 className="font-semibold">New Customer</h3>
              <input
                type="text"
                placeholder="Name *"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
                minLength={2}
                autoFocus
              />
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <input
                type="email"
                placeholder="Email (optional)"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!newCustomer.name || newCustomer.name.trim().length < 2}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewCustomer({ name: "", phone: "", email: "", dob: "", allergies: [], notes: "" });
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Search Results */}
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Searching...</div>
          ) : customers.length > 0 ? (
            <div className="space-y-2">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => {
                    setSelectedCustomer(customer);
                    onSelect(customer);
                  }}
                  className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                    selectedCustomer?.id === customer.id ? "border-blue-500 bg-blue-50" : ""
                  }`}
                >
                  <div className="font-medium">{customer.name}</div>
                  {customer.phone && (
                    <div className="text-sm text-gray-600 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {customer.phone}
                    </div>
                  )}
                  {customer.loyaltyPoints !== undefined && customer.loyaltyPoints > 0 && (
                    <div className="text-sm text-green-600 flex items-center gap-1 mt-1">
                      <Gift className="w-3 h-3" />
                      {customer.loyaltyPoints} points
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : searchQuery.length >= 2 ? (
            <div className="text-center py-8 text-gray-500">No customers found</div>
          ) : null}

          {/* Selected Customer Details */}
          {selectedCustomer && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="w-5 h-5" />
                {selectedCustomer.name}
              </h3>
              {selectedCustomer.phone && (
                <div className="text-sm flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {selectedCustomer.phone}
                </div>
              )}
              {selectedCustomer.email && (
                <div className="text-sm flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {selectedCustomer.email}
                </div>
              )}
              {selectedCustomer.loyaltyPoints !== undefined && (
                <div className="text-sm flex items-center gap-2 text-green-600">
                  <Gift className="w-4 h-4" />
                  {selectedCustomer.loyaltyPoints} loyalty points
                </div>
              )}
              {selectedCustomer.allergies && selectedCustomer.allergies.length > 0 && (
                <div className="text-sm">
                  <div className="flex items-center gap-2 text-orange-600 mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    Allergies:
                  </div>
                  <div className="pl-6">
                    {selectedCustomer.allergies.join(", ")}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

