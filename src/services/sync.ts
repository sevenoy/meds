// 同步控制器 - 多设备同步核心逻辑

import { supabase, isMockMode, getCurrentUserId } from '../lib/supabase';
import { db, getUnsyncedLogs, markLogSynced, updateMedicationLog, getDeviceId, getMedications, upsertMedication } from '../db/localDB';
import type { MedicationLog, ConflictInfo, Medication } from '../types';

/**
 * 同步medications到云端
 */
export async function syncMedications(): Promise<void> {
  if (isMockMode) return;
  
  const userId = await getCurrentUserId();
  if (!userId) return;
  
  try {
    const localMeds = await getMedications();
    
    // 推送本地medications到云端
    for (const med of localMeds) {
      const medData: any = {
        id: med.id,
        user_id: userId,
        name: med.name,
        dosage: med.dosage,
        scheduled_time: med.scheduled_time,
        updated_at: new Date().toISOString()
      };
      
      // 只有当 accent 存在且不为空时才添加
      if (med.accent) {
        medData.accent = med.accent;
      }
      
      await supabase!
        .from('medications')
        .upsert(medData);
    }
    
    // 拉取云端medications
    const { data: cloudMeds } = await supabase!
      .from('medications')
      .select('*')
      .eq('user_id', userId);
    
    if (cloudMeds) {
      for (const cloudMed of cloudMeds) {
        const localMed = localMeds.find(m => m.id === cloudMed.id);
        if (!localMed) {
          // 云端有但本地没有，添加到本地
          const medData: Medication = {
            id: cloudMed.id,
            name: cloudMed.name,
            dosage: cloudMed.dosage,
            scheduled_time: cloudMed.scheduled_time,
            user_id: cloudMed.user_id
          };
          
          // 只有当云端有 accent 时才添加
          if (cloudMed.accent) {
            medData.accent = cloudMed.accent;
          } else {
            // 如果没有，使用默认值
            medData.accent = '#E8F5E9'; // 默认浅绿色
          }
          
          await upsertMedication(medData);
        }
      }
    }
    
    console.log('✅ Medications同步完成');
  } catch (error) {
    console.error('❌ Medications同步失败:', error);
  }
}

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
        try {
          const { data: existing, error: queryError } = await supabase!
            .from('medication_logs')
            .select('id')
            .eq('image_hash', log.image_hash)
            .maybeSingle();
          
          // 406 错误通常表示查询格式问题，跳过检查继续插入
          if (queryError && queryError.code !== 'PGRST116') {
            console.warn('⚠️ 查询 image_hash 失败，继续插入:', queryError);
          } else if (existing) {
            // 已存在，更新本地记录
            await markLogSynced(log.id, { ...log, id: existing.id });
            continue;
          }
        } catch (err) {
          console.warn('⚠️ 检查重复记录失败，继续插入:', err);
        }
      }
      
      // 插入新记录（只发送数据库存在的字段）
      const { data, error } = await supabase!
        .from('medication_logs')
        .insert({
          id: log.id,
          user_id: userId,
          medication_id: log.medication_id,
          taken_at: log.taken_at,
          uploaded_at: log.uploaded_at,
          time_source: log.time_source,
          status: log.status,
          image_path: log.image_path,
          image_hash: log.image_hash,
          source_device: log.source_device,
          created_at: new Date().toISOString(),
          updated_at: log.updated_at || new Date().toISOString()
          // 注意：不发送 local_id 和 sync_state，这些是本地字段
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
    // 如果是字段不存在的错误，返回空数组（表结构可能未更新）
    if (error.message?.includes('column') || error.code === 'PGRST204') {
      console.warn('⚠️ 数据库表结构可能未更新，请执行 supabase-schema-fix.sql');
      return [];
    }
    return [];
  }
  
  // 转换数据，添加本地字段
  return (data || []).map(log => ({
    ...log,
    sync_state: 'clean' as SyncState,
    local_id: undefined // 云端数据没有 local_id
  }));
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
 * 初始化 Realtime 监听（增强版 - 基于云端同步技术文档）
 */
export function initRealtimeSync(
  onMedicationLogSync: (log: MedicationLog) => void,
  onMedicationSync: () => void
): () => void {
  if (isMockMode) {
    console.log('🔧 Mock模式：跳过Realtime同步');
    return () => {};
  }
  
  const currentDeviceId = getDeviceId();
  console.log('🔄 启动增强版 Realtime 同步... (device_id:', currentDeviceId, ')');
  
  // 创建一个channel监听所有变化
  const channel = supabase!
    .channel('medication-realtime-sync-' + currentDeviceId) // 使用唯一的channel名称
    // 监听medication_logs表的变化
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'medication_logs'
      },
      async (payload) => {
        console.log('📥 Realtime: medication_logs变化', payload.eventType, payload);
        
        if (payload.new) {
          const log = payload.new as MedicationLog;
          
          // 只处理其他设备的记录
          if (log.source_device !== currentDeviceId) {
            console.log('📱 检测到其他设备的服药记录:', {
              device: log.source_device,
              medication: log.medication_name,
              time: log.taken_at
            });
            
            // 直接同步，不需要用户确认
            onMedicationLogSync(log);
          } else {
            console.log('ℹ️ 本设备的记录，跳过');
          }
        }
      }
    )
    // 监听medications表的变化
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'medications'
      },
      async (payload) => {
        console.log('📥 Realtime: medications变化', payload.eventType, payload);
        
        if (payload.new) {
          const med = payload.new as any;
          const userId = await getCurrentUserId();
          
          // 只处理同一用户的数据
          if (med.user_id === userId) {
            console.log('💊 检测到药品列表更新');
            
            // 直接同步，不需要用户确认
        onMedicationSync();
          }
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ 药品数据 Realtime 订阅成功');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('❌ 药品数据 Realtime 订阅失败:', status);
      } else {
      console.log('🔄 Realtime订阅状态:', status);
      }
    });
  
  // 返回清理函数
  return () => {
    console.log('🔌 断开Realtime连接');
    supabase!.removeChannel(channel);
  };
}

