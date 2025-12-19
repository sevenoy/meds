// 本地数据库 (IndexedDB / Dexie) - Local-first 核心

import Dexie, { Table } from 'dexie';
import type { Medication, MedicationLog, SyncState } from '../types';

class LocalDatabase extends Dexie {
  medications!: Table<Medication, string>;
  medicationLogs!: Table<MedicationLog, string>;

  constructor() {
    super('MedicationTrackerDB');
    
    this.version(1).stores({
      medications: 'id, user_id, name, scheduled_time',
      medicationLogs: 'id, medication_id, user_id, taken_at, sync_state, [medication_id+taken_at]'
    });
  }
}

export const db = new LocalDatabase();

/**
 * 获取所有药物
 */
export async function getMedications(): Promise<Medication[]> {
  return await db.medications.toArray();
}

/**
 * 添加或更新药物
 */
export async function upsertMedication(med: Medication): Promise<void> {
  await db.medications.put(med);
}

/**
 * 删除药物
 */
export async function deleteMedication(medicationId: string): Promise<void> {
  await db.medications.delete(medicationId);
  // 同时删除相关的服药记录
  await db.medicationLogs.where('medication_id').equals(medicationId).delete();
}

/**
 * 获取药物的所有记录
 */
export async function getMedicationLogs(medicationId?: string): Promise<MedicationLog[]> {
  if (medicationId) {
    return await db.medicationLogs
      .where('medication_id')
      .equals(medicationId)
      .toArray();
  }
  return await db.medicationLogs.toArray();
}

/**
 * 添加药物记录（本地优先）
 */
export async function addMedicationLog(log: MedicationLog): Promise<string> {
  // 如果没有 ID，生成本地临时 ID
  if (!log.id) {
    log.id = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    log.local_id = log.id;
  }
  
  // 设置同步状态
  log.sync_state = 'dirty';
  
  await db.medicationLogs.add(log);
  return log.id;
}

/**
 * 更新药物记录
 */
export async function updateMedicationLog(log: MedicationLog): Promise<void> {
  log.sync_state = 'dirty';
  log.updated_at = new Date().toISOString();
  await db.medicationLogs.put(log);
}

/**
 * 获取未同步的记录
 */
export async function getUnsyncedLogs(): Promise<MedicationLog[]> {
  return await db.medicationLogs
    .where('sync_state')
    .anyOf(['dirty', 'conflict'])
    .toArray();
}

/**
 * 标记记录为已同步
 */
export async function markLogSynced(logId: string, remoteLog: MedicationLog): Promise<void> {
  await db.medicationLogs.update(logId, {
    ...remoteLog,
    sync_state: 'clean'
  });
}

/**
 * 获取设备标识
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}



