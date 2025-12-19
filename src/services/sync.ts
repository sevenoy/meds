// 同步控制器 - 多设备同步核心逻辑

import { supabase, isMockMode, getCurrentUserId } from '../lib/supabase';
import { db, getUnsyncedLogs, markLogSynced, updateMedicationLog, getDeviceId } from '../db/localDB';
import type { MedicationLog, ConflictInfo } from '../types';

/**
 * 推送本地未同步的记录到服务器
 */
export async function pushLocalChanges(): Promise<void> {
  if (isMockMode) {
    // Mock 模式：标记为已同步
    const unsynced = await getUnsyncedLogs();
    for (const log of unsynced) {
      await markLogSynced(log.id, log);
    }
    return;
  }
  
  const userId = await getCurrentUserId();
  if (!userId) return;
  
  const unsynced = await getUnsyncedLogs();
  
  for (const log of unsynced) {
    try {
      // 检查是否已存在（通过 image_hash）
      if (log.image_hash) {
        const { data: existing } = await supabase!
          .from('medication_logs')
          .select('id')
          .eq('image_hash', log.image_hash)
          .single();
        
        if (existing) {
          // 已存在，更新本地记录
          await markLogSynced(log.id, { ...log, id: existing.id });
          continue;
        }
      }
      
      // 插入新记录
      const { data, error } = await supabase!
        .from('medication_logs')
        .insert({
          ...log,
          user_id: userId,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // 标记为已同步
      await markLogSynced(log.id, data);
    } catch (error) {
      console.error('同步失败:', error);
      // 保持 dirty 状态，稍后重试
    }
  }
}

/**
 * 从服务器拉取最新记录
 */
export async function pullRemoteChanges(lastSyncTime?: string): Promise<MedicationLog[]> {
  if (isMockMode) {
    // Mock 模式：返回空数组
    return [];
  }
  
  const userId = await getCurrentUserId();
  if (!userId) return [];
  
  let query = supabase!
    .from('medication_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (lastSyncTime) {
    query = query.gt('updated_at', lastSyncTime);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('拉取失败:', error);
    return [];
  }
  
  return data || [];
}

/**
 * 检测冲突
 */
export function detectConflict(
  local: MedicationLog,
  remote: MedicationLog
): ConflictInfo | null {
  // 同一记录被不同设备修改
  if (local.id === remote.id && local.updated_at !== remote.updated_at) {
    return {
      local,
      remote,
      reason: '同一记录在不同设备被修改'
    };
  }
  
  // EXIF 时间不同（可疑）
  if (local.image_hash === remote.image_hash && 
      local.taken_at !== remote.taken_at) {
    return {
      local,
      remote,
      reason: '相同照片但时间戳不同'
    };
  }
  
  return null;
}

/**
 * 合并远程记录到本地
 */
export async function mergeRemoteLog(log: MedicationLog): Promise<void> {
  const existing = await db.medicationLogs.get(log.id);
  
  if (!existing) {
    // 新记录，直接添加
    await db.medicationLogs.add({
      ...log,
      sync_state: 'clean'
    });
    return;
  }
  
  // 检测冲突
  const conflict = detectConflict(existing, log);
  if (conflict) {
    // 标记为冲突，等待用户决策
    await db.medicationLogs.update(existing.id, {
      ...existing,
      sync_state: 'conflict'
    });
    return;
  }
  
  // 无冲突，更新本地记录
  await markLogSynced(existing.id, log);
}

/**
 * 初始化 Realtime 监听
 */
export function initRealtimeSync(
  onSyncEvent: (log: MedicationLog) => void
): () => void {
  if (isMockMode) {
    // Mock 模式：返回空清理函数
    return () => {};
  }
  
  const currentDeviceId = getDeviceId();
  
  const channel = supabase!
    .channel('medication-sync')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'medication_logs'
      },
      async (payload) => {
        if (payload.new) {
          const log = payload.new as MedicationLog;
          // 只处理其他设备的记录
          if (log.source_device !== currentDeviceId) {
            onSyncEvent(log);
          }
        }
      }
    )
    .subscribe();
  
  // 返回清理函数
  return () => {
    supabase!.removeChannel(channel);
  };
}

