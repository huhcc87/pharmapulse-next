'use client';

import { useState, useEffect } from 'react';
import { Pill, TrendingUp, AlertTriangle, CheckCircle2, Calendar, User, Phone, Edit2, Trash2, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';

interface Patient {
  id: number;
  name: string;
  phone: string;
  medication: string;
  adherenceRate: number;
  status: 'good' | 'moderate' | 'poor';
  lastDose: string;
  nextDose: string;
  missedDoses: number;
}

export default function AdherencePage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showHowToUse, setShowHowToUse] = useState(false);
  const [formData, setFormData] = useState<Partial<Patient>>({
    name: '',
    phone: '',
    medication: '',
    adherenceRate: 0,
    status: 'moderate',
    lastDose: '',
    nextDose: '',
    missedDoses: 0,
  });

  // Fetch patients on mount
  useEffect(() => {
    fetchPatients();
  }, []);

  async function fetchPatients() {
    try {
      setLoading(true);
      const res = await fetch('/api/adherence');
      if (!res.ok) throw new Error('Failed to fetch patients');
      const data = await res.json();
      setPatients(data);
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    try {
      const res = await fetch('/api/adherence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to create patient' }));
        throw new Error(errorData.error || 'Failed to create patient');
      }
      
      await fetchPatients();
      setShowCreateModal(false);
      resetForm();
    } catch (error: any) {
      console.error('Error creating patient:', error);
      alert(error.message || 'Failed to create patient. Please try again.');
    }
  }

  async function handleUpdate() {
    if (!selectedPatient) return;
    try {
      const res = await fetch(`/api/adherence/${selectedPatient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to update patient' }));
        throw new Error(errorData.error || 'Failed to update patient');
      }
      
      const updatedPatient = await res.json();
      await fetchPatients();
      setShowEditModal(false);
      setSelectedPatient(null);
      resetForm();
    } catch (error: any) {
      console.error('Error updating patient:', error);
      alert(error.message || 'Failed to update patient. Please try again.');
    }
  }

  async function handleDelete() {
    if (!selectedPatient) return;
    try {
      const res = await fetch(`/api/adherence/${selectedPatient.id}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to delete patient' }));
        throw new Error(errorData.error || 'Failed to delete patient');
      }
      
      await fetchPatients();
      setShowDeleteModal(false);
      setSelectedPatient(null);
    } catch (error: any) {
      console.error('Error deleting patient:', error);
      alert(error.message || 'Failed to delete patient. Please try again.');
    }
  }

  function openEditModal(patient: Patient) {
    setSelectedPatient(patient);
    setFormData({
      name: patient.name,
      phone: patient.phone,
      medication: patient.medication,
      adherenceRate: patient.adherenceRate,
      status: patient.status,
      lastDose: patient.lastDose,
      nextDose: patient.nextDose,
      missedDoses: patient.missedDoses,
    });
    setShowEditModal(true);
  }

  function openDeleteModal(patient: Patient) {
    setSelectedPatient(patient);
    setShowDeleteModal(true);
  }

  function resetForm() {
    setFormData({
      name: '',
      phone: '',
      medication: '',
      adherenceRate: 0,
      status: 'moderate',
      lastDose: '',
      nextDose: '',
      missedDoses: 0,
    });
  }

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient.medication.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || patient.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'good':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Good
          </span>
        );
      case 'moderate':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Moderate
          </span>
        );
      case 'poor':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Poor
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const averageAdherence = patients.length > 0 
    ? patients.reduce((sum, p) => sum + p.adherenceRate, 0) / patients.length 
    : 0;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Medication Adherence</h1>
          <p className="text-gray-600">Track patient medication adherence and send reminders</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add New Patient
        </button>
      </div>

      {/* Step-by-Step Guidelines - Collapsible */}
      <div className="bg-blue-50 border-l-4 border-blue-500 mb-6 rounded-r-lg overflow-hidden">
        <button
          onClick={() => setShowHowToUse(!showHowToUse)}
          className="w-full p-6 flex items-center justify-between hover:bg-blue-100 transition-colors"
        >
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Pill className="w-6 h-6 text-blue-500" />
            How to Use Medication Adherence Tracking
          </h2>
          {showHowToUse ? (
            <ChevronUp className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-600" />
          )}
        </button>
        {showHowToUse && (
          <div className="px-6 pb-6 space-y-4 text-gray-700">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">1</div>
              <div>
                <h3 className="font-semibold mb-1">Add Patient Information</h3>
                <p className="text-sm">Click the "Add New Patient" button above to create a new patient record. Enter the patient's name, phone number, and medication details.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">2</div>
              <div>
                <h3 className="font-semibold mb-1">Track Medication Details</h3>
                <p className="text-sm">For each patient, record their medication name, adherence rate (percentage), last dose time, next dose time, and number of missed doses.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">3</div>
              <div>
                <h3 className="font-semibold mb-1">Monitor Adherence Status</h3>
                <p className="text-sm">The system automatically categorizes patients as "Good" (≥80%), "Moderate" (60-79%), or "Poor" (&lt;60%) based on their adherence rate.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">4</div>
              <div>
                <h3 className="font-semibold mb-1">Update Records Regularly</h3>
                <p className="text-sm">Click the "Edit" button on any patient row to update their medication status, adherence rate, or dose information as needed.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">5</div>
              <div>
                <h3 className="font-semibold mb-1">Use Search and Filters</h3>
                <p className="text-sm">Use the search bar to find patients by name or medication. Filter by adherence status (Good/Moderate/Poor) to focus on patients who need attention.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">6</div>
              <div>
                <h3 className="font-semibold mb-1">Review Statistics</h3>
                <p className="text-sm">Monitor the summary cards at the top to see total patients, average adherence rate, and how many patients need attention.</p>
              </div>
            </div>
            <div className="mt-6 p-4 bg-white rounded-lg border border-blue-200">
              <p className="text-sm font-semibold text-gray-900 mb-2">💡 Tip:</p>
              <p className="text-sm text-gray-700">Start by adding your first patient using the "Add New Patient" button. You can track multiple medications per patient by creating separate entries.</p>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Patients</p>
              <p className="text-2xl font-bold text-gray-900">{patients.length}</p>
            </div>
            <User className="w-8 h-8 text-teal-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Adherence</p>
              <p className="text-2xl font-bold text-gray-900">{Math.round(averageAdherence)}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Good Adherence</p>
              <p className="text-2xl font-bold text-gray-900">{patients.filter(p => p.status === 'good').length}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Needs Attention</p>
              <p className="text-2xl font-bold text-gray-900">{patients.filter(p => p.status === 'poor').length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search patients or medications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">All Status</option>
            <option value="good">Good</option>
            <option value="moderate">Moderate</option>
            <option value="poor">Poor</option>
          </select>
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medication</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adherence Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Dose</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Next Dose</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Missed Doses</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    Loading patients...
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    {searchTerm || filterStatus !== 'all' 
                      ? 'No patients found matching your search criteria.'
                      : 'No patients found. Click "Add New Patient" to get started.'}
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => (
                <tr key={patient.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-semibold mr-3">
                        {patient.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{patient.name}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {patient.phone}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{patient.medication}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className={`h-2 rounded-full ${
                            patient.adherenceRate >= 80 ? 'bg-green-500' :
                            patient.adherenceRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${patient.adherenceRate}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{patient.adherenceRate}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(patient.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {patient.lastDose}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {patient.nextDose}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${
                      patient.missedDoses > 10 ? 'text-red-600' :
                      patient.missedDoses > 5 ? 'text-yellow-600' : 'text-gray-600'
                    }`}>
                      {patient.missedDoses}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(patient)}
                        className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => openDeleteModal(patient)}
                        className="text-red-600 hover:text-red-900 flex items-center gap-1"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-semibold">Add New Patient</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Enter patient name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medication <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.medication || ''}
                  onChange={(e) => setFormData({ ...formData, medication: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="e.g., Metformin 500mg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adherence Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.adherenceRate || 0}
                    onChange={(e) => setFormData({ ...formData, adherenceRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status || 'moderate'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'good' | 'moderate' | 'poor' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="good">Good</option>
                    <option value="moderate">Moderate</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Dose</label>
                  <input
                    type="text"
                    value={formData.lastDose || ''}
                    onChange={(e) => setFormData({ ...formData, lastDose: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="2025-12-23 08:00 AM"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Next Dose</label>
                  <input
                    type="text"
                    value={formData.nextDose || ''}
                    onChange={(e) => setFormData({ ...formData, nextDose: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="2025-12-23 08:00 PM"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Missed Doses</label>
                <input
                  type="number"
                  min="0"
                  value={formData.missedDoses || 0}
                  onChange={(e) => setFormData({ ...formData, missedDoses: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!formData.name || !formData.medication}
                className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-semibold">Edit Patient</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedPatient(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medication <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.medication || ''}
                  onChange={(e) => setFormData({ ...formData, medication: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adherence Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.adherenceRate || 0}
                    onChange={(e) => setFormData({ ...formData, adherenceRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status || 'moderate'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'good' | 'moderate' | 'poor' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="good">Good</option>
                    <option value="moderate">Moderate</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Dose</label>
                  <input
                    type="text"
                    value={formData.lastDose || ''}
                    onChange={(e) => setFormData({ ...formData, lastDose: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Next Dose</label>
                  <input
                    type="text"
                    value={formData.nextDose || ''}
                    onChange={(e) => setFormData({ ...formData, nextDose: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Missed Doses</label>
                <input
                  type="number"
                  min="0"
                  value={formData.missedDoses || 0}
                  onChange={(e) => setFormData({ ...formData, missedDoses: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedPatient(null);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={!formData.name || !formData.medication}
                className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Update Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-red-600">Delete Patient</h2>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedPatient(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Are you sure you want to delete <strong>{selectedPatient.name}</strong>?
              </p>
              <p className="text-sm text-gray-500">
                This action cannot be undone. All adherence data for this patient will be permanently deleted.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedPatient(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete Patient
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

