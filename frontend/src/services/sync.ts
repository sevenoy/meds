import { db } from '../db/localDB';
import { supabase, getCurrentUserId, getDeviceId } from '../lib/supabase';
import type { Medication, MedicationLog, SyncState } from '../../shared/types';

/**
 * 推送本地变更到云端
 */
export async function pushLocalChanges(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const deviceId = getDeviceId();

  // 推送未同步的药品
  const unsyncedMeds = await db.medications
    .where('user_id')
    .equals(userId)
    .filter((med) => !med.sync_state || med.sync_state === 'dirty')
    .toArray();

  for (const med of unsyncedMeds) {
    try {
      const { error } = await supabase
        .from('medications')
        .upsert(
          {
            ...med,
            device_id: deviceId,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'id' }
        );

      if (!error) {
        await db.medications.update(med.id, {
          sync_state: 'clean' as SyncState
        });
      }
    } catch (error) {
      console.error('同步药品失败:', med.id, error);
    }
  }

  // 推送未同步的记录
  const unsyncedLogs = await db.medicationLogs
    .where('user_id')
    .equals(userId)
    .filter((log) => !log.sync_state || log.sync_state === 'dirty')
    .toArray();

  for (const log of unsyncedLogs) {
    try {
      const { error } = await supabase
        .from('medication_logs')
        .upsert(
          {
            ...log,
            source_device: deviceId,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'id' }
        );

      if (!error) {
        await db.medicationLogs.update(log.id, {
          sync_state: 'clean' as SyncState
        });
      }
    } catch (error) {
      console.error('同步记录失败:', log.id, error);
    }
  }
}

/**
 * 从云端拉取变更
 */
export async function pullRemoteChanges(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  // 拉取药品
  const { data: medications, error: medError } = await supabase
    .from('medications')
    .select('*')
    .eq('user_id', userId);

  if (!medError && medications) {
    await db.medications.bulkPut(medications);
  }

  // 拉取记录
  const { data: logs, error: logError } = await supabase
    .from('medication_logs')
    .select('*')
    .eq('user_id', userId)
    .order('taken_at', { ascending: false })
    .limit(100);

  if (!logError && logs) {
    await db.medicationLogs.bulkPut(logs);
  }
}

/**
 * 同步所有数据
 */
export async function syncAll(): Promise<void> {
  try {
    await pushLocalChanges();
    await pullRemoteChanges();
  } catch (error) {
    console.error('同步失败:', error);
    throw error;
  }
}

