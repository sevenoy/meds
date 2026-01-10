import { supabase, getCurrentUserId } from '../lib/supabase';
import { APP_VERSION } from '../config/version';
import type { Medication, MedicationLog } from '../types';
import { logger } from '../utils/logger';

/**
 * 获取设备ID（用于 Realtime 过滤自身更新）
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

/**
 * 检查并强制版本同步
 */
export async function enforceVersionSync(): Promise<void> {
  const userId = await getCurrentUserId();

  if (!userId || !supabase) {
    logger.warn('⚠️ 用户未登录或 Supabase 未配置，跳过版本检查');
    return;
  }

  const versionCheckDisabledKey = 'version_check_disabled_column_missing';
  if (localStorage.getItem(versionCheckDisabledKey) === 'true') {
    return;
  }

  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('required_version')
      .eq('owner_id', userId)
      .maybeSingle();

    if (error) {
      if (error.code === '42703' || error.message?.includes('does not exist')) {
        localStorage.setItem(versionCheckDisabledKey, 'true');
        return;
      }
      logger.warn('⚠️ 版本检查查询失败（非阻塞）:', error.code, error.message);
      return;
    }

    const requiredVersion = data?.required_version;
    if (requiredVersion && requiredVersion !== APP_VERSION) {
      logger.warn('🚨 版本不一致，强制更新!', { currentVersion: APP_VERSION, requiredVersion });

      try {
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(reg => reg.unregister()));
        }
        const deviceId = localStorage.getItem('device_id');
        localStorage.clear();
        if (deviceId) localStorage.setItem('device_id', deviceId);
        sessionStorage.clear();
        if ('indexedDB' in window) {
          const dbs = await indexedDB.databases();
          for (const db of dbs) {
            if (db.name) indexedDB.deleteDatabase(db.name);
          }
        }
      } catch (cleanupError) {
        logger.warn('⚠️ 清理缓存时出错:', cleanupError);
      }

      alert(`检测到新版本 ${requiredVersion}，即将自动更新...`);
      window.location.reload();
      throw new Error('VERSION_MISMATCH');
    }

    if (!requiredVersion) {
      await supabase.from('app_state').update({ required_version: APP_VERSION }).eq('owner_id', userId);
    }
  } catch (error: any) {
    if (error.message === 'VERSION_MISMATCH') throw error;
    console.error('❌ 版本检查异常:', error);
  }
}

/**
 * 从云端读取所有药品
 */
export async function getMedicationsFromCloud(): Promise<Medication[]> {
  const userId = await getCurrentUserId();
  if (!userId || !supabase) return [];

  try {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.error('❌ 读取药品失败:', error);
      return [];
    }
    return data || [];
  } catch (error: any) {
    console.error('❌ 读取药品异常:', error);
    return [];
  }
}

/**
 * 快速加载今日服药记录（首屏优化）
 */
export async function getTodayLogsFromCloud(): Promise<MedicationLog[]> {
  const userId = await getCurrentUserId();
  if (!userId || !supabase) return [];

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 我们选择 uploaded_at 为 created_at 的别名，以满足 MedicationLog 类型
    const { data, error } = await supabase
      .from('medication_logs')
      .select('id,medication_id,taken_at,created_at,uploaded_at:created_at,device_id,status,time_source,image_path')
      .eq('user_id', userId)
      .gte('taken_at', today.toISOString())
      .lt('taken_at', tomorrow.toISOString())
      .order('taken_at', { ascending: false });

    if (error) {
      console.error('❌ 读取今日服药记录失败:', error);
      return [];
    }
    return (data as any) || [];
  } catch (error) {
    console.error('❌ 读取今日服药记录异常:', error);
    return [];
  }
}

/**
 * 从云端读取服药记录（瘦身版本）
 */
export async function getLogsFromCloud(medicationId?: string, limit: number = 300, daysLimit: number = 60): Promise<MedicationLog[]> {
  const userId = await getCurrentUserId();
  if (!userId || !supabase) return [];

  try {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - daysLimit);

    let query = supabase
      .from('medication_logs')
      .select('id,medication_id,taken_at,created_at,uploaded_at:created_at,device_id,status,time_source,image_path')
      .eq('user_id', userId)
      .gte('taken_at', daysAgo.toISOString())
      .order('taken_at', { ascending: false })
      .limit(limit);

    if (medicationId) query = query.eq('medication_id', medicationId);

    const { data, error } = await query;
    if (error) {
      console.error('❌ 读取服药记录失败:', error);
      return [];
    }
    return (data as any) || [];
  } catch (error) {
    console.error('❌ 读取服药记录异常:', error);
    return [];
  }
}

/**
 * 获取最近的 N 条服药记录（无视日期，用于首屏快速加载）
 */
export async function getRecentLogsFromCloud(limit: number = 20): Promise<MedicationLog[]> {
  const userId = await getCurrentUserId();
  if (!userId || !supabase) return [];

  try {
    const { data, error } = await supabase
      .from('medication_logs')
      .select('id,medication_id,taken_at,created_at,uploaded_at:created_at,device_id,status,time_source,image_path')
      .eq('user_id', userId)
      .order('taken_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ 读取最近记录失败:', error);
      return [];
    }
    return (data as any) || [];
  } catch (error) {
    console.error('❌ 读取最近记录异常:', error);
    return [];
  }
}

/**
 * 清理药品数据（白名单）
 */
export function sanitizeMedicationForDb(med: any): Partial<Medication> {
  const allowedKeys = ['id', 'user_id', 'name', 'dosage', 'scheduled_time', 'accent', 'created_at'];
  const sanitized: any = {};
  allowedKeys.forEach(key => {
    if (med[key] !== undefined) sanitized[key] = med[key];
  });
  return sanitized;
}

/**
 * 将药品同步到云端
 */
export async function upsertMedicationToCloud(med: Medication): Promise<Medication | null> {
  const userId = await getCurrentUserId();
  if (!userId || !supabase) return null;

  try {
    const sanitized = sanitizeMedicationForDb(med);
    const { data, error } = await supabase
      .from('medications')
      .upsert({ ...sanitized, user_id: userId })
      .select()
      .maybeSingle();

    if (error) {
      console.error('❌ 同步药品到云端失败:', error);
      return null;
    }
    if (!data) {
      console.error('❌ upsert 返回空数据,可能是 RLS 权限问题');
      return null;
    }
    return data;
  } catch (error) {
    console.error('❌ 同步药品到云端异常:', error);
    return null;
  }
}

/**
 * 添加服药记录到云端
 */
export async function addLogToCloud(log: Partial<MedicationLog>): Promise<MedicationLog | null> {
  const userId = await getCurrentUserId();
  if (!userId || !supabase) return null;

  try {
    const insertPayload = { ...log, user_id: userId };

    // 🔴 诊断日志 3: addLogToCloud 内部打印"实际发送给 Supabase 的 insert 对象"
    console.log('[CLOUD] insert log payload', insertPayload);

    const { data, error } = await supabase
      .from('medication_logs')
      .insert(insertPayload)
      .select()
      .maybeSingle();

    if (error) {
      console.error('❌ 添加服药记录失败:', error);
      return null;
    }
    if (!data) {
      console.error('❌ insert 返回空数据');
      return null;
    }
    return data;
  } catch (error) {
    console.error('❌ 添加服药记录异常:', error);
    return null;
  }
}

/**
 * 更新云端服药记录
 */
export async function updateLogToCloud(id: string, updates: Partial<MedicationLog>): Promise<MedicationLog | null> {
  const userId = await getCurrentUserId();
  if (!userId || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('medication_logs')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('❌ 更新服药记录失败:', error);
      return null;
    }
    if (!data) {
      console.error('❌ update 返回空数据');
      return null;
    }
    return data;
  } catch (error) {
    console.error('❌ 更新服药记录异常:', error);
    return null;
  }
}

/**
 * 删除云端药品
 */
export async function deleteMedicationFromCloud(id: string): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId || !supabase) return false;

  try {
    const { error } = await supabase
      .from('medications')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ 删除云端药品失败:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('❌ 删除云端药品异常:', error);
    return false;
  }
}

/**
 * 初始化云端 Realtime（延迟逻辑见 App.tsx）
 */
let realtimeStartupLatch = false;
export async function initCloudOnlyRealtime(callbacks: {
  onMedicationChange: (payload: { eventType: string; new?: any; old?: any }) => void;
  onLogChange: (payload: { eventType: string; new?: any; old?: any }) => void;
  onStatusChange?: (status: 'connected' | 'disconnected' | 'connecting') => void;
}): Promise<() => void> {
  if (realtimeStartupLatch) return () => { };
  realtimeStartupLatch = true;

  callbacks.onStatusChange?.('connecting');

  const medicationsChannel = supabase
    .channel('medications-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'medications' }, (payload) => {
      callbacks.onMedicationChange(payload);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        callbacks.onStatusChange?.('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        callbacks.onStatusChange?.('disconnected');
      }
    });

  const logsChannel = supabase
    .channel('medication-logs-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'medication_logs' }, (payload) => {
      callbacks.onLogChange(payload);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(medicationsChannel);
    supabase.removeChannel(logsChannel);
    realtimeStartupLatch = false;
    callbacks.onStatusChange?.('disconnected');
  };
}
