"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Pill,
  Calendar,
  Clock,
  Bell,
  User,
  FileText,
  ShoppingCart,
  Heart,
  Settings,
  LogOut,
} from "lucide-react";
import { showToast } from "@/lib/toast";

interface Prescription {
  id: number;
  patientName: string;
  doctorName: string;
  date: string;
  status: string;
  medicines: Array<{
    name: string;
    dosage: string;
    frequency: string;
  }>;
}

interface MedicationReminder {
  id: number;
  medicineName: string;
  time: string;
  status: "PENDING" | "TAKEN" | "MISSED";
  date: string;
}

export default function PatientPortalPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"medications" | "prescriptions" | "reminders" | "profile">("medications");
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [reminders, setReminders] = useState<MedicationReminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Load prescriptions
      const presRes = await fetch("/api/patient-portal/prescriptions");
      if (presRes.ok) {
        const presData = await presRes.json();
        setPrescriptions(presData.prescriptions || []);
      }

      // Load reminders
      const remRes = await fetch("/api/patient-portal/reminders");
      if (remRes.ok) {
        const remData = await remRes.json();
        setReminders(remData.reminders || []);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }

  async function markMedicationTaken(reminderId: number) {
    try {
      const res = await fetch(`/api/patient-portal/reminders/${reminderId}/mark-taken`, {
        method: "POST",
      });

      if (res.ok) {
        showToast("Medication marked as taken", "success");
        loadData();
      } else {
        showToast("Failed to update medication", "error");
      }
    } catch (error) {
      showToast("Failed to update medication", "error");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Pill className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Patient Portal</h1>
            </div>
            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <Bell className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: "medications", label: "My Medications", icon: Pill },
              { id: "prescriptions", label: "Prescriptions", icon: FileText },
              { id: "reminders", label: "Reminders", icon: Bell },
              { id: "profile", label: "Profile", icon: User },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm
                  ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        ) : (
          <>
            {/* Medications Tab */}
            {activeTab === "medications" && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold mb-4">Current Medications</h2>
                {prescriptions.length === 0 ? (
                  <div className="bg-white rounded-lg shadow p-8 text-center">
                    <Pill className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No active medications</p>
                  </div>
                ) : (
                  prescriptions.map((prescription) => (
                    <div key={prescription.id} className="bg-white rounded-lg shadow p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">{prescription.patientName}</h3>
                          <p className="text-sm text-gray-600">Dr. {prescription.doctorName}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(prescription.date).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            prescription.status === "ACTIVE"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {prescription.status}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {prescription.medicines.map((med, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                            <Pill className="w-4 h-4 text-blue-600" />
                            <div className="flex-1">
                              <p className="font-medium">{med.name}</p>
                              <p className="text-sm text-gray-600">
                                {med.dosage} - {med.frequency}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Prescriptions Tab */}
            {activeTab === "prescriptions" && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold mb-4">Prescription History</h2>
                {prescriptions.length === 0 ? (
                  <div className="bg-white rounded-lg shadow p-8 text-center">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No prescriptions found</p>
                  </div>
                ) : (
                  prescriptions.map((prescription) => (
                    <div key={prescription.id} className="bg-white rounded-lg shadow p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">Prescription #{prescription.id}</h3>
                          <p className="text-sm text-gray-600">
                            Dr. {prescription.doctorName} - {new Date(prescription.date).toLocaleDateString()}
                          </p>
                        </div>
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          View Details
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Reminders Tab */}
            {activeTab === "reminders" && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold mb-4">Medication Reminders</h2>
                {reminders.length === 0 ? (
                  <div className="bg-white rounded-lg shadow p-8 text-center">
                    <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No reminders scheduled</p>
                  </div>
                ) : (
                  reminders.map((reminder) => (
                    <div
                      key={reminder.id}
                      className={`bg-white rounded-lg shadow p-6 ${
                        reminder.status === "PENDING" ? "border-l-4 border-blue-500" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-blue-100 rounded-lg">
                            <Clock className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{reminder.medicineName}</h3>
                            <p className="text-sm text-gray-600">
                              {reminder.time} - {new Date(reminder.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              reminder.status === "TAKEN"
                                ? "bg-green-100 text-green-700"
                                : reminder.status === "MISSED"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {reminder.status}
                          </span>
                          {reminder.status === "PENDING" && (
                            <button
                              onClick={() => markMedicationTaken(reminder.id)}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                              Mark Taken
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Profile Settings</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      defaultValue="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      defaultValue="+91 9876543210"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      defaultValue="john@example.com"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm text-gray-700">
                        Enable medication reminders via SMS/WhatsApp
                      </span>
                    </label>
                  </div>
                  <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
