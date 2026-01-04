import Dexie, { Table } from 'dexie';
import type { Medication, MedicationLog } from '../../shared/types';

class LocalDatabase extends Dexie {
  medications!: Table<Medication, string>;
  medicationLogs!: Table<MedicationLog, string>;

  constructor() {
    super('MedicationTrackerDB');
    
    this.version(1).stores({
      medications: 'id, user_id, name, scheduled_time, device_id',
      medicationLogs: 'id, medication_id, user_id, taken_at, sync_state, [medication_id+taken_at]'
    });
  }
}

export const db = new LocalDatabase();

