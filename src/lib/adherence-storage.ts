// Shared in-memory storage for medication adherence
// In production, this should be replaced with Prisma database queries

export interface AdherenceRecord {
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

let adherenceData: AdherenceRecord[] = [];

let nextId = 1;

export function getAllRecords(): AdherenceRecord[] {
  return adherenceData;
}

export function getRecordById(id: number): AdherenceRecord | undefined {
  return adherenceData.find((r) => r.id === id);
}

export function createRecord(record: Omit<AdherenceRecord, 'id'>): AdherenceRecord {
  const newRecord: AdherenceRecord = {
    id: nextId++,
    ...record,
  };
  adherenceData.push(newRecord);
  return newRecord;
}

export function updateRecord(id: number, updates: Partial<Omit<AdherenceRecord, 'id'>>): AdherenceRecord | null {
  const index = adherenceData.findIndex((r) => r.id === id);
  if (index === -1) return null;
  
  adherenceData[index] = {
    ...adherenceData[index],
    ...updates,
  };
  return adherenceData[index];
}

export function deleteRecord(id: number): boolean {
  const index = adherenceData.findIndex((r) => r.id === id);
  if (index === -1) return false;
  
  adherenceData.splice(index, 1);
  return true;
}

