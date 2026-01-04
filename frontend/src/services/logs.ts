import { db } from '../db/localDB';
import { supabase, getCurrentUserId, getDeviceId } from '../lib/supabase';
import { calculateImageHash } from '../utils/crypto';
import type { MedicationLog, TimeSource, LogStatus } from '../../shared/types';

/**
 * 计算服药状态
 */
function calculateStatus(
  scheduledTime: string,
  takenAt: Date,
  timeSource: TimeSource
): LogStatus {
  if (timeSource === 'manual') {
    return 'manual';
  }

  // 解析计划时间
  const [scheduledHour, scheduledMinute] = scheduledTime.split(':').map(Number);
  const scheduledDate = new Date(takenAt);
  scheduledDate.setHours(scheduledHour, scheduledMinute, 0, 0);

  // 计算时间差（分钟）
  const diffMinutes = Math.abs((takenAt.getTime() - scheduledDate.getTime()) / (1000 * 60));

  if (diffMinutes <= 30) {
    return 'ontime';
  } else {
    return 'late';
  }
}

/**
 * 添加服药记录
 */
export async function addMedicationLog(
  medicationId: string,
  imageData: string,
  takenAt: Date,
  timeSource: TimeSource
): Promise<MedicationLog> {
  const userId = await getCurrentUserId();
  const deviceId = getDeviceId();
  const imageHash = calculateImageHash(imageData);

  // 获取药品信息以计算状态
  const medication = await db.medications.get(medicationId);
  const status = medication
    ? calculateStatus(medication.scheduled_time, takenAt, timeSource)
    : 'manual';

  const log: MedicationLog = {
    id: crypto.randomUUID(),
    medication_id: medicationId,
    user_id: userId || undefined,
    taken_at: takenAt.toISOString(),
    uploaded_at: new Date().toISOString(),
    time_source: timeSource,
    status: status,
    image_path: imageData, // 本地存储为 DataURL
    image_hash: imageHash,
    source_device: deviceId,
    sync_state: 'dirty',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // 保存到本地数据库
  await db.medicationLogs.add(log);

  // 尝试同步到云端
  try {
    const { error } = await supabase
      .from('medication_logs')
      .insert({
        ...log,
        image_path: undefined // 云端存储路径，稍后上传
      });

    if (!error) {
      log.sync_state = 'clean';
      await db.medicationLogs.update(log.id, { sync_state: 'clean' });
    }
  } catch (error) {
    console.error('同步记录失败:', error);
  }

  return log;
}

/**
 * 获取服药记录
 */
export async function getMedicationLogs(medicationId?: string): Promise<MedicationLog[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  let query = db.medicationLogs.where('user_id').equals(userId);

  if (medicationId) {
    query = query.filter(log => log.medication_id === medicationId);
  }

  const logs = await query.toArray();

  // 按时间倒序排序
  return logs.sort((a, b) => 
    new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()
  );
}

/**
 * 获取最近7天的记录
 */
export async function getRecentLogs(days: number = 7): Promise<MedicationLog[]> {
  const allLogs = await getMedicationLogs();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return allLogs.filter(log => new Date(log.taken_at) >= cutoffDate);
}

