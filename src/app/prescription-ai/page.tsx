'use client';

import { useState, useEffect, useRef } from 'react';
import { Brain, Search, FileText, AlertTriangle, CheckCircle2, Clock, Pill, User, Plus, Edit, Trash2, Phone, X, Save, Bell, Calendar, Send, MessageSquare } from 'lucide-react';

interface Medication {
  id: number;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

interface Reminder {
  id: number;
  type: 'medicine' | 'checkup';
  date: string;
  time: string;
  message: string;
  status: 'pending' | 'sent' | 'completed' | 'cancelled';
  sentAt?: string;
  completedAt?: string;
}

interface Prescription {
  id: number;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  doctorPhone: string;
  date: string;
  status: 'pending' | 'verified' | 'dispensed' | 'rejected';
  medications: Medication[];
  aiConfidence: number;
  issues: string[];
  reminders: Reminder[];
  lastReminderUpdate?: string;
}

export default function PrescriptionAIPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPrescription, setEditingPrescription] = useState<Prescription | null>(null);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderPrescription, setReminderPrescription] = useState<Prescription | null>(null);
  const [showRemindersPanel, setShowRemindersPanel] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-update reminders (check every minute)
  useEffect(() => {
    const interval = setInterval(() => {
      updateReminderStatuses();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [prescriptions]);

  const updateReminderStatuses = () => {
    const now = new Date();
    setPrescriptions(prevPrescriptions => 
      prevPrescriptions.map(prescription => {
        const updatedReminders = prescription.reminders.map(reminder => {
          if (reminder.status === 'pending') {
            const reminderDateTime = new Date(`${reminder.date}T${reminder.time}`);
            // Auto-send reminder 1 hour before scheduled time
            const oneHourBefore = new Date(reminderDateTime.getTime() - 60 * 60 * 1000);
            
            if (now >= oneHourBefore && now < reminderDateTime) {
              // Auto-send reminder
              return {
                ...reminder,
                status: 'sent' as const,
                sentAt: now.toISOString(),
              };
            } else if (now >= reminderDateTime) {
              // Mark as completed if past due
              return {
                ...reminder,
                status: 'completed' as const,
                completedAt: now.toISOString(),
              };
            }
          }
          return reminder;
        });

        const hasUpdates = JSON.stringify(updatedReminders) !== JSON.stringify(prescription.reminders);
        
        return hasUpdates ? {
          ...prescription,
          reminders: updatedReminders,
          lastReminderUpdate: now.toISOString(),
        } : prescription;
      })
    );
  };

  const filteredPrescriptions = prescriptions.filter(prescription => {
    const matchesSearch = prescription.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prescription.doctorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prescription.patientPhone.includes(searchTerm) ||
                         prescription.doctorPhone.includes(searchTerm);
    const matchesStatus = filterStatus === 'all' || prescription.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Verified
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </span>
        );
      case 'dispensed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Pill className="w-3 h-3 mr-1" />
            Dispensed
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Rejected
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const handleAdd = (prescription: Omit<Prescription, 'id'>) => {
    const newId = prescriptions.length > 0 ? Math.max(...prescriptions.map(p => p.id)) + 1 : 1;
    const newPrescription = { ...prescription, id: newId, reminders: prescription.reminders || [] };
    setPrescriptions([...prescriptions, newPrescription]);
    setIsAddModalOpen(false);
    return newPrescription;
  };

  const handleEdit = (prescription: Prescription) => {
    setEditingPrescription(prescription);
    setIsEditModalOpen(true);
  };

  const handleUpdate = (updated: Prescription | Omit<Prescription, 'id'>) => {
    if ('id' in updated) {
      setPrescriptions(prescriptions.map(p => p.id === updated.id ? { ...updated, reminders: updated.reminders || [] } : p));
    } else if (editingPrescription) {
      setPrescriptions(prescriptions.map(p => p.id === editingPrescription.id ? { ...updated, id: editingPrescription.id, reminders: updated.reminders || [] } : p));
    }
    setIsEditModalOpen(false);
    setEditingPrescription(null);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this prescription?')) {
      setPrescriptions(prescriptions.filter(p => p.id !== id));
    }
  };

  const handleVerify = (id: number) => {
    setPrescriptions(prescriptions.map(p => 
      p.id === id ? { ...p, status: 'verified' as const } : p
    ));
  };

  const handleReject = (id: number) => {
    setPrescriptions(prescriptions.map(p => 
      p.id === id ? { ...p, status: 'rejected' as const } : p
    ));
  };

  const handleDispense = (id: number) => {
    setPrescriptions(prescriptions.map(p => 
      p.id === id ? { ...p, status: 'dispensed' as const } : p
    ));
  };

  const handleOpenReminderModal = (prescription: Prescription) => {
    setReminderPrescription(prescription);
    setIsReminderModalOpen(true);
  };

  const handleAddReminder = (prescriptionId: number, reminder: Omit<Reminder, 'id'>) => {
    const prescription = prescriptions.find(p => p.id === prescriptionId);
    const newReminderId = prescription?.reminders.length 
      ? Math.max(...prescription.reminders.map(r => r.id)) + 1 
      : 1;
    
    setPrescriptions(prescriptions.map(p => 
      p.id === prescriptionId 
        ? { 
            ...p, 
            reminders: [...(p.reminders || []), { ...reminder, id: newReminderId }],
            lastReminderUpdate: new Date().toISOString(),
          }
        : p
    ));
  };

  const handleSendReminder = (prescriptionId: number, reminderId: number, customMessage?: string) => {
    setPrescriptions(prescriptions.map(p => 
      p.id === prescriptionId 
        ? {
            ...p,
            reminders: (p.reminders || []).map(r => 
              r.id === reminderId 
                ? { 
                    ...r, 
                    status: 'sent' as const,
                    sentAt: new Date().toISOString(),
                    message: customMessage || r.message,
                  }
                : r
            ),
            lastReminderUpdate: new Date().toISOString(),
          }
        : p
    ));
    
    // Show notification to retailer
    const prescription = prescriptions.find(p => p.id === prescriptionId);
    if (prescription) {
      const reminder = prescription.reminders?.find(r => r.id === reminderId);
      if (reminder) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-20 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-md';
        notification.innerHTML = `
          <div class="flex items-start gap-3">
            <CheckCircle2 class="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p class="font-semibold">✅ Reminder Sent!</p>
              <p class="text-sm mt-1">To: ${prescription.patientName} (${prescription.patientPhone})</p>
              <p class="text-sm">Type: ${reminder.type === 'medicine' ? 'Medicine Follow-up' : 'Checkup'}</p>
              <p class="text-sm">Date: ${reminder.date} at ${reminder.time}</p>
              <p class="text-sm mt-1">${customMessage || reminder.message}</p>
            </div>
          </div>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
      }
    }
  };

  const handleDeleteReminder = (prescriptionId: number, reminderId: number) => {
    setPrescriptions(prescriptions.map(p => 
      p.id === prescriptionId 
        ? {
            ...p,
            reminders: (p.reminders || []).filter(r => r.id !== reminderId),
            lastReminderUpdate: new Date().toISOString(),
          }
        : p
    ));
  };

  // Get upcoming reminders for retailer dashboard
  const getUpcomingReminders = () => {
    const allReminders: Array<{ prescription: Prescription; reminder: Reminder }> = [];
    prescriptions.forEach(prescription => {
      (prescription.reminders || []).forEach(reminder => {
        if (reminder.status === 'pending' || reminder.status === 'sent') {
          allReminders.push({ prescription, reminder });
        }
      });
    });
    
    return allReminders.sort((a, b) => {
      const dateA = new Date(`${a.reminder.date}T${a.reminder.time}`);
      const dateB = new Date(`${b.reminder.date}T${b.reminder.time}`);
      return dateA.getTime() - dateB.getTime();
    });
  };

  const upcomingReminders = getUpcomingReminders();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Prescription AI</h1>
          <p className="text-gray-600">AI-powered prescription verification and analysis</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRemindersPanel(!showRemindersPanel)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg relative ${
              showRemindersPanel 
                ? 'bg-teal-500 text-white' 
                : 'border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Bell className="w-5 h-5" />
            Reminders
            {upcomingReminders.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {upcomingReminders.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
          >
            <Plus className="w-5 h-5" />
            Add Prescription
          </button>
          <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <FileText className="w-5 h-5" />
            Upload Prescription
          </button>
        </div>
      </div>

      {/* Reminders Panel */}
      {showRemindersPanel && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="w-6 h-6 text-teal-500" />
              Upcoming Reminders ({upcomingReminders.length})
            </h2>
            <button
              onClick={() => setShowRemindersPanel(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {upcomingReminders.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No upcoming reminders</p>
          ) : (
            <div className="space-y-3">
              {upcomingReminders.slice(0, 10).map(({ prescription, reminder }, idx) => {
                const reminderDate = new Date(`${reminder.date}T${reminder.time}`);
                const isDueSoon = reminderDate.getTime() - Date.now() < 24 * 60 * 60 * 1000; // Within 24 hours
                
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border ${
                      isDueSoon ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            reminder.type === 'medicine' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {reminder.type === 'medicine' ? 'Medicine Follow-up' : 'Checkup'}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            reminder.status === 'sent' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {reminder.status === 'sent' ? 'Sent' : 'Pending'}
                          </span>
                        </div>
                        <p className="font-semibold text-gray-900">{prescription.patientName}</p>
                        <p className="text-sm text-gray-600 mb-1">{prescription.patientPhone}</p>
                        <p className="text-sm text-gray-700 mb-2">{reminder.message}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {reminder.date} at {reminder.time}
                          </span>
                          {reminder.sentAt && (
                            <span className="flex items-center gap-1">
                              <Send className="w-3 h-3" />
                              Sent: {new Date(reminder.sentAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {reminder.status === 'pending' && (
                          <button
                            onClick={() => handleSendReminder(prescription.id, reminder.id)}
                            className="px-3 py-1 bg-teal-500 text-white rounded text-xs hover:bg-teal-600 flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            Send Now
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setReminderPrescription(prescription);
                            setIsReminderModalOpen(true);
                          }}
                          className="px-3 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Prescriptions</p>
              <p className="text-2xl font-bold text-gray-900">{prescriptions.length}</p>
            </div>
            <FileText className="w-8 h-8 text-teal-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Pending Review</p>
              <p className="text-2xl font-bold text-gray-900">{prescriptions.filter(p => p.status === 'pending').length}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Verified</p>
              <p className="text-2xl font-bold text-gray-900">{prescriptions.filter(p => p.status === 'verified').length}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Upcoming Reminders</p>
              <p className="text-2xl font-bold text-gray-900">{upcomingReminders.length}</p>
            </div>
            <Bell className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by patient, doctor name, or phone number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="dispensed">Dispensed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Prescriptions Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {prescriptions.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No prescriptions yet</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="text-teal-600 hover:text-teal-700 font-medium"
            >
              Add your first prescription
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Doctor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medications</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">AI Confidence</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPrescriptions.map((prescription) => (
                  <tr key={prescription.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-semibold mr-3">
                          {prescription.patientName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{prescription.patientName}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {prescription.patientPhone || 'No phone'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">{prescription.doctorName}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {prescription.doctorPhone || 'No phone'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {prescription.medications.length > 0 ? (
                          prescription.medications.map((med, idx) => (
                            <span key={idx} className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs mr-1 mb-1">
                              {med.name} {med.dosage}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400">No medications</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-full bg-gray-200 rounded-full h-2 mr-2" style={{ width: '60px' }}>
                          <div
                            className={`h-2 rounded-full ${
                              prescription.aiConfidence > 0.8 ? 'bg-green-500' :
                              prescription.aiConfidence > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${prescription.aiConfidence * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-900">{Math.round(prescription.aiConfidence * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(prescription.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {prescription.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleOpenReminderModal(prescription)}
                          className="text-purple-600 hover:text-purple-900 p-1 relative"
                          title="Manage Reminders"
                        >
                          <Bell className="w-4 h-4" />
                          {(prescription.reminders || []).filter(r => r.status === 'pending' || r.status === 'sent').length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                              {(prescription.reminders || []).filter(r => r.status === 'pending' || r.status === 'sent').length}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(prescription)}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(prescription.id)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {prescription.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleVerify(prescription.id)}
                              className="text-green-600 hover:text-green-900 text-xs"
                            >
                              Verify
                            </button>
                            <button
                              onClick={() => handleReject(prescription.id)}
                              className="text-red-600 hover:text-red-900 text-xs"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {prescription.status === 'verified' && (
                          <button
                            onClick={() => handleDispense(prescription.id)}
                            className="text-blue-600 hover:text-blue-900 text-xs"
                          >
                            Dispense
                          </button>
                        )}
                        {prescription.issues.length > 0 && (
                          <button
                            onClick={() => setSelectedPrescription(prescription)}
                            className="text-orange-600 hover:text-orange-900 text-xs"
                          >
                            Issues
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Prescription Modal */}
      {isAddModalOpen && (
        <PrescriptionModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSave={handleAdd}
        />
      )}

      {/* Edit Prescription Modal */}
      {isEditModalOpen && editingPrescription && (
        <PrescriptionModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingPrescription(null);
          }}
          onSave={handleUpdate}
          prescription={editingPrescription}
        />
      )}

      {/* Reminder Modal */}
      {isReminderModalOpen && reminderPrescription && (
        <ReminderModal
          prescription={reminderPrescription}
          onClose={() => {
            setIsReminderModalOpen(false);
            setReminderPrescription(null);
          }}
          onAddReminder={handleAddReminder}
          onSendReminder={handleSendReminder}
          onDeleteReminder={handleDeleteReminder}
        />
      )}

      {/* Upload Prescription Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Upload Prescription</h2>
              <button
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setUploadError(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Prescription Image/PDF
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    setUploading(true);
                    setUploadError(null);

                    try {
                      // Create a FormData object to upload the file
                      const formData = new FormData();
                      formData.append('file', file);

                      // Try to upload to API endpoint if it exists
                      try {
                        const response = await fetch('/api/prescription/upload', {
                          method: 'POST',
                          body: formData,
                        });

                        if (response.ok) {
                          const data = await response.json();
                          // If API returns parsed prescription data, use it
                          if (data.prescription) {
                            handleAdd(data.prescription);
                            setIsUploadModalOpen(false);
                            setUploading(false);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                            
                            const successMsg = document.createElement('div');
                            successMsg.className = 'fixed top-20 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
                            successMsg.innerHTML = '✅ Prescription uploaded successfully!';
                            document.body.appendChild(successMsg);
                            setTimeout(() => successMsg.remove(), 3000);
                            return;
                          }
                        }
                      } catch (apiError) {
                        // API endpoint doesn't exist or failed, continue with local processing
                        console.log('Upload API not available, using local file handling');
                      }

                      // Fallback: Create a preview and allow manual entry
                      // Read file as data URL for preview
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const imageUrl = event.target?.result as string;
                        
                        // Create a new prescription from uploaded file
                        // In a real app, you'd send this to an AI service for OCR/parsing
                        const newPrescription: Omit<Prescription, 'id'> = {
                          patientName: 'Patient Name (Edit Required)',
                          patientPhone: '',
                          doctorName: 'Doctor Name (Edit Required)',
                          doctorPhone: '',
                          date: new Date().toISOString().split('T')[0],
                          status: 'pending',
                          medications: [],
                          aiConfidence: 0.5,
                          issues: ['Please review and edit the prescription details manually'],
                          reminders: [],
                        };

                        // Add prescription and get the new prescription with ID
                        const addedPrescription = handleAdd(newPrescription);
                        
                        // Open edit modal with the newly added prescription
                        setTimeout(() => {
                          setEditingPrescription(addedPrescription);
                          setIsEditModalOpen(true);
                        }, 100);

                        setIsUploadModalOpen(false);
                        setUploading(false);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                        
                        const successMsg = document.createElement('div');
                        successMsg.className = 'fixed top-20 right-4 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
                        successMsg.innerHTML = '📄 File uploaded. Please review and edit the prescription details.';
                        document.body.appendChild(successMsg);
                        setTimeout(() => successMsg.remove(), 4000);
                      };
                      
                      if (file.type.startsWith('image/')) {
                        reader.readAsDataURL(file);
                      } else {
                        // For PDFs, just create the prescription directly
                        const newPrescription: Omit<Prescription, 'id'> = {
                          patientName: 'Patient Name (Edit Required)',
                          patientPhone: '',
                          doctorName: 'Doctor Name (Edit Required)',
                          doctorPhone: '',
                          date: new Date().toISOString().split('T')[0],
                          status: 'pending',
                          medications: [],
                          aiConfidence: 0.5,
                          issues: ['Please review and edit the prescription details manually'],
                          reminders: [],
                        };

                        // Add prescription and get the new prescription with ID
                        const addedPrescription = handleAdd(newPrescription);
                        
                        // Open edit modal with the newly added prescription
                        setTimeout(() => {
                          setEditingPrescription(addedPrescription);
                          setIsEditModalOpen(true);
                        }, 100);

                        setIsUploadModalOpen(false);
                        setUploading(false);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                        
                        const successMsg = document.createElement('div');
                        successMsg.className = 'fixed top-20 right-4 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
                        successMsg.innerHTML = '📄 PDF uploaded. Please review and edit the prescription details.';
                        document.body.appendChild(successMsg);
                        setTimeout(() => successMsg.remove(), 4000);
                      }
                    } catch (error: any) {
                      console.error('Upload error:', error);
                      setUploadError(error?.message || 'Failed to upload file. Please try again.');
                      setUploading(false);
                    }
                  }}
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer hover:border-teal-500"
                  disabled={uploading}
                />
                <p className="mt-2 text-xs text-gray-500">
                  Supported formats: JPG, PNG, PDF (Max 10MB)
                </p>
              </div>

              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{uploadError}</p>
                </div>
              )}

              {uploading && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Processing prescription...
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setUploadError(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={uploading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Issues Modal */}
      {selectedPrescription && selectedPrescription.issues.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">AI Detected Issues</h3>
              <button
                onClick={() => setSelectedPrescription(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-2">
              {selectedPrescription.issues.map((issue, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{issue}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedPrescription(null)}
                className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Prescription Modal Component
interface PrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (prescription: Prescription | Omit<Prescription, 'id'>) => void;
  prescription?: Prescription;
}

function PrescriptionModal({ isOpen, onClose, onSave, prescription }: PrescriptionModalProps) {
  const [formData, setFormData] = useState({
    patientName: prescription?.patientName || '',
    patientPhone: prescription?.patientPhone || '',
    doctorName: prescription?.doctorName || '',
    doctorPhone: prescription?.doctorPhone || '',
    date: prescription?.date || new Date().toISOString().split('T')[0],
    status: prescription?.status || 'pending' as const,
    medications: prescription?.medications || [] as Medication[],
    aiConfidence: prescription?.aiConfidence || 0.85,
    issues: prescription?.issues || [] as string[],
    reminders: prescription?.reminders || [] as Reminder[],
  });

  const [newMedication, setNewMedication] = useState({
    name: '',
    dosage: '',
    frequency: '',
    duration: '',
  });

  const [medicationSearch, setMedicationSearch] = useState({
    name: '',
    dosage: '',
    frequency: '',
    duration: '',
  });

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [showDosageDropdown, setShowDosageDropdown] = useState(false);
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const nameDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (nameDropdownRef.current && !nameDropdownRef.current.contains(event.target as Node)) {
        setShowNameDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Common medication options
  const dosageOptions = ['250mg', '500mg', '650mg', '1000mg', '10mg', '20mg', '5mg', '50mg', '100mg', '200mg', '400mg', 'Other'];
  const frequencyOptions = ['Once daily', 'Twice daily', 'Thrice daily', '2x daily', '3x daily', '4x daily', 'Before meals', 'After meals', 'As needed', 'Other'];
  const durationOptions = ['3 days', '5 days', '7 days', '10 days', '14 days', '21 days', '30 days', '1 month', '2 months', '3 months', 'Ongoing', 'Other'];

  // Search medications from drug library
  useEffect(() => {
    if (medicationSearch.name.length >= 2) {
      const timeoutId = setTimeout(async () => {
        try {
          const response = await fetch(`/api/drug-library/search?q=${encodeURIComponent(medicationSearch.name)}&limit=10`);
          const data = await response.json();
          setSearchResults(data);
          setShowNameDropdown(true);
        } catch (error) {
          console.error('Error searching medications:', error);
        }
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
      setShowNameDropdown(false);
    }
  }, [medicationSearch.name]);

  const handleSelectMedication = (med: any) => {
    const name = med.brand || med.formulation || med.composition || medicationSearch.name;
    const dosage = med.composition?.match(/(\d+\s*(mg|g|ml|%))/i)?.[0] || '';
    setNewMedication({
      name,
      dosage: dosage || newMedication.dosage,
      frequency: newMedication.frequency,
      duration: newMedication.duration,
    });
    setMedicationSearch({ ...medicationSearch, name });
    setShowNameDropdown(false);
  };

  const handleAddMedication = () => {
    if (newMedication.name.trim() && newMedication.dosage.trim()) {
      const medId = formData.medications.length > 0 
        ? Math.max(...formData.medications.map(m => m.id)) + 1 
        : 1;
      setFormData({
        ...formData,
        medications: [...formData.medications, { ...newMedication, id: medId }],
      });
      setNewMedication({ name: '', dosage: '', frequency: '', duration: '' });
      setMedicationSearch({ name: '', dosage: '', frequency: '', duration: '' });
    } else {
      alert('Please enter medication name and dosage');
    }
  };

  const handleRemoveMedication = (id: number) => {
    setFormData({
      ...formData,
      medications: formData.medications.filter(m => m.id !== id),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prescription) {
      onSave({ ...formData, id: prescription.id, reminders: formData.reminders });
    } else {
      onSave({ ...formData, reminders: formData.reminders });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {prescription ? 'Edit Prescription' : 'Add New Prescription'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Patient Section */}
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Patient Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.patientName}
                  onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Patient Phone
                </label>
                <input
                  type="tel"
                  value={formData.patientPhone}
                  onChange={(e) => setFormData({ ...formData, patientPhone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="+91 9876543210"
                />
              </div>
            </div>
          </div>

          {/* Doctor Section */}
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Doctor Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Doctor Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.doctorName}
                  onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Doctor Phone
                </label>
                <input
                  type="tel"
                  value={formData.doctorPhone}
                  onChange={(e) => setFormData({ ...formData, doctorPhone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="+91 9876543210"
                />
              </div>
            </div>
          </div>

          {/* Medications Section */}
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Pill className="w-5 h-5" />
              Medications
            </h3>
            
            {/* Existing Medications */}
            {formData.medications.map((med) => (
              <div key={med.id} className="flex items-center gap-2 mb-2 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 grid grid-cols-4 gap-2">
                  <span className="text-sm font-medium">{med.name}</span>
                  <span className="text-sm text-gray-600">{med.dosage}</span>
                  <span className="text-sm text-gray-600">{med.frequency}</span>
                  <span className="text-sm text-gray-600">{med.duration}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveMedication(med.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* Add Medication Form */}
            <div className="mt-4 p-4 bg-teal-50 rounded-lg border border-teal-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Add Medication</h4>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {/* Medication Name - Searchable Dropdown */}
                <div className="relative" ref={nameDropdownRef}>
                  <input
                    type="text"
                    placeholder="Search medication..."
                    value={medicationSearch.name}
                    onChange={(e) => {
                      setMedicationSearch({ ...medicationSearch, name: e.target.value });
                      setNewMedication({ ...newMedication, name: e.target.value });
                    }}
                    onFocus={() => medicationSearch.name.length >= 2 && setShowNameDropdown(true)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  {showNameDropdown && searchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {searchResults.map((med, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectMedication(med)}
                          className="px-3 py-2 hover:bg-teal-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium">{med.brand || med.formulation || med.composition}</div>
                          {med.composition && (
                            <div className="text-xs text-gray-500">{med.composition}</div>
                          )}
                          {med.manufacturer && (
                            <div className="text-xs text-gray-400">by {med.manufacturer}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dosage - Dropdown */}
                <div className="relative">
                  <select
                    value={newMedication.dosage}
                    onChange={(e) => {
                      setNewMedication({ ...newMedication, dosage: e.target.value });
                      if (e.target.value === 'Other') {
                        const customDosage = prompt('Enter custom dosage:');
                        if (customDosage) {
                          setNewMedication({ ...newMedication, dosage: customDosage });
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  >
                    <option value="">Select dosage</option>
                    {dosageOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {/* Frequency - Dropdown */}
                <div className="relative">
                  <select
                    value={newMedication.frequency}
                    onChange={(e) => {
                      setNewMedication({ ...newMedication, frequency: e.target.value });
                      if (e.target.value === 'Other') {
                        const customFreq = prompt('Enter custom frequency:');
                        if (customFreq) {
                          setNewMedication({ ...newMedication, frequency: customFreq });
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  >
                    <option value="">Select frequency</option>
                    {frequencyOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {/* Duration - Dropdown */}
                <div className="relative">
                  <select
                    value={newMedication.duration}
                    onChange={(e) => {
                      setNewMedication({ ...newMedication, duration: e.target.value });
                      if (e.target.value === 'Other') {
                        const customDur = prompt('Enter custom duration:');
                        if (customDur) {
                          setNewMedication({ ...newMedication, duration: customDur });
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  >
                    <option value="">Select duration</option>
                    {durationOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddMedication}
                className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!newMedication.name.trim() || !newMedication.dosage.trim()}
              >
                <Plus className="w-4 h-4" />
                Add Medication
              </button>
            </div>
          </div>

          {/* Status and Date Section */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="dispensed">Dispensed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
          </div>

          {/* AI Confidence */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI Confidence: {Math.round(formData.aiConfidence * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={formData.aiConfidence}
              onChange={(e) => setFormData({ ...formData, aiConfidence: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {prescription ? 'Update' : 'Save'} Prescription
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Reminder Modal Component
interface ReminderModalProps {
  prescription: Prescription;
  onClose: () => void;
  onAddReminder: (prescriptionId: number, reminder: Omit<Reminder, 'id'>) => void;
  onSendReminder: (prescriptionId: number, reminderId: number, customMessage?: string) => void;
  onDeleteReminder: (prescriptionId: number, reminderId: number) => void;
}

function ReminderModal({ prescription, onClose, onAddReminder, onSendReminder, onDeleteReminder }: ReminderModalProps) {
  const [newReminder, setNewReminder] = useState({
    type: 'medicine' as 'medicine' | 'checkup',
    date: '',
    time: '',
    message: '',
  });
  const [customMessage, setCustomMessage] = useState('');
  const [sendingReminderId, setSendingReminderId] = useState<number | null>(null);

  const handleAddReminder = () => {
    if (newReminder.date && newReminder.time && newReminder.message) {
      const defaultMessage = newReminder.type === 'medicine'
        ? `Reminder: Follow-up for your medication. Please visit us or call for refill.`
        : `Reminder: You have a scheduled checkup appointment. Please visit us.`;
      
      onAddReminder(prescription.id, {
        type: newReminder.type,
        date: newReminder.date,
        time: newReminder.time,
        message: newReminder.message || defaultMessage,
        status: 'pending',
      });
      
      setNewReminder({
        type: 'medicine',
        date: '',
        time: '',
        message: '',
      });
    }
  };

  const handleSendWithCustomMessage = (reminderId: number) => {
    if (customMessage.trim()) {
      onSendReminder(prescription.id, reminderId, customMessage);
      setCustomMessage('');
      setSendingReminderId(null);
    } else {
      onSendReminder(prescription.id, reminderId);
      setSendingReminderId(null);
    }
  };

  const reminders = prescription.reminders || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Manage Reminders</h2>
            <p className="text-sm text-gray-600 mt-1">
              {prescription.patientName} - {prescription.patientPhone}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Add New Reminder */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add New Reminder
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reminder Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={newReminder.type}
                  onChange={(e) => setNewReminder({ ...newReminder, type: e.target.value as 'medicine' | 'checkup' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="medicine">Medicine Follow-up</option>
                  <option value="checkup">Checkup Appointment</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={newReminder.date}
                    onChange={(e) => setNewReminder({ ...newReminder, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={newReminder.time}
                    onChange={(e) => setNewReminder({ ...newReminder, time: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newReminder.message}
                  onChange={(e) => setNewReminder({ ...newReminder, message: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  rows={3}
                  placeholder={newReminder.type === 'medicine' 
                    ? 'e.g., Reminder: Follow-up for your medication. Please visit us or call for refill.'
                    : 'e.g., Reminder: You have a scheduled checkup appointment. Please visit us.'
                  }
                  required
                />
              </div>

              <button
                onClick={handleAddReminder}
                className="w-full px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Reminder
              </button>
            </div>
          </div>

          {/* Existing Reminders */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Existing Reminders ({reminders.length})
            </h3>
            
            {reminders.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No reminders set</p>
            ) : (
              <div className="space-y-3">
                {reminders.map((reminder) => {
                  const reminderDate = new Date(`${reminder.date}T${reminder.time}`);
                  const isPast = reminderDate < new Date();
                  
                  return (
                    <div
                      key={reminder.id}
                      className={`p-4 rounded-lg border ${
                        reminder.status === 'sent' 
                          ? 'bg-green-50 border-green-200' 
                          : reminder.status === 'completed'
                          ? 'bg-gray-50 border-gray-200'
                          : isPast
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              reminder.type === 'medicine' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {reminder.type === 'medicine' ? 'Medicine Follow-up' : 'Checkup'}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              reminder.status === 'sent' 
                                ? 'bg-green-100 text-green-700'
                                : reminder.status === 'completed'
                                ? 'bg-gray-100 text-gray-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {reminder.status === 'sent' ? 'Sent' : reminder.status === 'completed' ? 'Completed' : 'Pending'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{reminder.message}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {reminder.date} at {reminder.time}
                            </span>
                            {reminder.sentAt && (
                              <span className="flex items-center gap-1">
                                <Send className="w-3 h-3" />
                                Sent: {new Date(reminder.sentAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {reminder.status === 'pending' && (
                            <>
                              {sendingReminderId === reminder.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={customMessage}
                                    onChange={(e) => setCustomMessage(e.target.value)}
                                    placeholder="Custom message (optional)"
                                    className="px-3 py-1 border border-gray-300 rounded text-xs w-48"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleSendWithCustomMessage(reminder.id);
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={() => handleSendWithCustomMessage(reminder.id)}
                                    className="px-3 py-1 bg-teal-500 text-white rounded text-xs hover:bg-teal-600 flex items-center gap-1"
                                  >
                                    <Send className="w-3 h-3" />
                                    Send
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSendingReminderId(null);
                                      setCustomMessage('');
                                    }}
                                    className="text-gray-500 hover:text-gray-700"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setSendingReminderId(reminder.id);
                                    setCustomMessage(reminder.message);
                                  }}
                                  className="px-3 py-1 bg-teal-500 text-white rounded text-xs hover:bg-teal-600 flex items-center gap-1"
                                >
                                  <Send className="w-3 h-3" />
                                  Send Now
                                </button>
                              )}
                            </>
                          )}
                          <button
                            onClick={() => onDeleteReminder(prescription.id, reminder.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
