/**
 * 纯云端服务 - 完全移除 IndexedDB，所有数据从 Supabase 读取
 * 架构：所有设备必须版本一致，所有数据实时从云端读取
 */

import { supabase, getCurrentUserId } from '../lib/supabase';
import { APP_VERSION } from '../config/version';
import type { Medication, MedicationLog } from '../types';

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
 * 如果云端 required_version 与当前版本不一致，强制清除缓存并刷新
 */
export async function enforceVersionSync(): Promise<void> {
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cloudOnly.ts:enforceVersionSync:entry',message:'enforceVersionSync called',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B1'})}).catch(()=>{});
  // #endregion
  
  const userId = await getCurrentUserId();
  
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cloudOnly.ts:enforceVersionSync:userId',message:'Got userId',data:{userId:userId||'null',hasSupabase:!!supabase},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C1'})}).catch(()=>{});
  // #endregion
  
  if (!userId || !supabase) {
    console.warn('⚠️ 用户未登录或 Supabase 未配置，跳过版本检查');
    return;
  }

  // 【减少无意义 400】检查缓存标记，如果列不存在，直接跳过，不发起请求
  const versionCheckDisabledKey = 'version_check_disabled_column_missing';
  const isVersionCheckDisabled = localStorage.getItem(versionCheckDisabledKey) === 'true';
  
  if (isVersionCheckDisabled) {
    console.log('ℹ️ 版本检查已禁用（列缺失/功能关闭）');
    return; // 直接返回，不发起网络请求
  }

  try {
    // 1. 查询云端 required_version
    const { data, error } = await supabase
      .from('app_state')
      .select('required_version')
      .eq('owner_id', userId)
      .maybeSingle();

    if (error) {
      // 【容错处理】如果列不存在（42703），设置缓存标记，后续不再查询
      if (error.code === '42703' || error.message?.includes('does not exist')) {
        // 设置缓存标记，后续启动时直接跳过
        localStorage.setItem(versionCheckDisabledKey, 'true');
        console.log('ℹ️ 版本检查跳过：required_version 列不存在（数据库未迁移），已禁用后续查询');
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cloudOnly.ts:enforceVersionSync:columnMissing',message:'Version check skipped - column missing, cached',data:{errorCode:error.code,errorMessage:error.message},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        return; // 静默返回，不报错，不触发刷新
      }
      
      // 其他错误仍然记录（但不阻塞）
      console.warn('⚠️ 版本检查查询失败（非阻塞）:', error.code, error.message);
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cloudOnly.ts:enforceVersionSync:error',message:'Query error (non-blocking)',data:{error:error.message,code:error.code},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B1'})}).catch(()=>{});
      // #endregion
      return; // 静默返回，不阻塞应用启动
    }
    
    // 【成功查询】如果查询成功，清除禁用标记（可能数据库已迁移）
    if (localStorage.getItem(versionCheckDisabledKey) === 'true') {
      localStorage.removeItem(versionCheckDisabledKey);
      console.log('✅ 版本检查已重新启用（数据库可能已迁移）');
    }

    const requiredVersion = data?.required_version;
    console.log('🔍 版本检查:', { currentVersion: APP_VERSION, requiredVersion });
    
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cloudOnly.ts:enforceVersionSync:compare',message:'Version comparison',data:{currentVersion:APP_VERSION,requiredVersion:requiredVersion||'null',match:requiredVersion===APP_VERSION},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B1'})}).catch(()=>{});
    // #endregion

    // 2. 如果云端有 required_version 且与当前版本不一致
    if (requiredVersion && requiredVersion !== APP_VERSION) {
      console.warn('🚨 版本不一致，强制更新!', {
        currentVersion: APP_VERSION,
        requiredVersion
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cloudOnly.ts:enforceVersionSync:mismatch',message:'VERSION MISMATCH - will reload',data:{currentVersion:APP_VERSION,requiredVersion:requiredVersion},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B1'})}).catch(()=>{});
      // #endregion

      // 3. 清除所有缓存
      try {
        // 清除 Service Worker 缓存
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
          console.log('✅ 已清除 Service Worker 缓存');
        }

        // 注销所有 Service Worker
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(reg => reg.unregister()));
          console.log('✅ 已注销 Service Worker');
        }

        // 清除 localStorage（保留 device_id）
        const deviceId = localStorage.getItem('device_id');
        localStorage.clear();
        if (deviceId) localStorage.setItem('device_id', deviceId);
        console.log('✅ 已清除 localStorage');

        // 清除 sessionStorage
        sessionStorage.clear();
        console.log('✅ 已清除 sessionStorage');

        // 清除 IndexedDB（如果存在）
        if ('indexedDB' in window) {
          const dbs = await indexedDB.databases();
          for (const db of dbs) {
            if (db.name) {
              indexedDB.deleteDatabase(db.name);
              console.log(`✅ 已删除 IndexedDB: ${db.name}`);
            }
          }
        }

      } catch (cleanupError) {
        console.warn('⚠️ 清理缓存时出错:', cleanupError);
      }

      // 4. 显示提示并强制刷新
      alert(`检测到新版本 ${requiredVersion}，即将自动更新...`);
      window.location.reload();
      
      // 阻止后续代码执行
      throw new Error('VERSION_MISMATCH');
    }

    // 5. 如果云端没有 required_version，设置为当前版本
    if (!requiredVersion) {
      console.log('📝 云端未设置 required_version，设置为当前版本:', APP_VERSION);
      
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cloudOnly.ts:enforceVersionSync:setVersion',message:'Setting required_version',data:{version:APP_VERSION},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B1'})}).catch(()=>{});
      // #endregion
      
      await supabase
        .from('app_state')
        .update({ required_version: APP_VERSION })
        .eq('owner_id', userId);
    }

  } catch (error: any) {
    if (error.message === 'VERSION_MISMATCH') {
      throw error; // 重新抛出，阻止应用初始化
    }
    console.error('❌ 版本检查异常:', error);
  }
}

/**
 * 从云端读取所有药品（不使用本地缓存）
 */
export async function getMedicationsFromCloud(): Promise<Medication[]> {
  const userId = await getCurrentUserId();
  
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cloudOnly.ts:getMedicationsFromCloud:entry',message:'getMedicationsFromCloud called',data:{userId:userId||'null',hasSupabase:!!supabase},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C1'})}).catch(()=>{});
  // #endregion
  
  if (!userId || !supabase) {
    console.warn('⚠️ 用户未登录或 Supabase 未配置');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.error('❌ 读取药品失败:', error);
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cloudOnly.ts:getMedicationsFromCloud:error',message:'Supabase query error',data:{error:error.message,code:error.code,hint:error.hint},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C2'})}).catch(()=>{});
      // #endregion
      return [];
    }

    console.log(`📥 从云端读取到 ${data?.length || 0} 个药品`);
    
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cloudOnly.ts:getMedicationsFromCloud:success',message:'Medications fetched',data:{count:data?.length||0,firstMedName:data?.[0]?.name||'none'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C2'})}).catch(()=>{});
    // #endregion
    
    return data || [];
  } catch (error: any) {
    console.error('❌ 读取药品异常:', error);
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cloudOnly.ts:getMedicationsFromCloud:exception',message:'Exception thrown',data:{error:error.message,stack:error.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C3'})}).catch(()=>{});
    // #endregion
    return [];
  }
}

/**
 * 从云端读取所有服药记录（不使用本地缓存）
 */
export async function getLogsFromCloud(medicationId?: string): Promise<MedicationLog[]> {
  const userId = await getCurrentUserId();
  if (!userId || !supabase) {
    console.warn('⚠️ 用户未登录或 Supabase 未配置');
    return [];
  }

  try {
    let query = supabase
      .from('medication_logs')
      .select('*')
      .eq('user_id', userId)
      .order('taken_at', { ascending: false });

    if (medicationId) {
      query = query.eq('medication_id', medicationId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ 读取服药记录失败:', error);
      return [];
    }

    console.log(`📥 从云端读取到 ${data?.length || 0} 条服药记录`);
    return data || [];
  } catch (error) {
    console.error('❌ 读取服药记录异常:', error);
    return [];
  }
}

/**
 * 清理药品数据，只保留数据库列（白名单）
 * 删除所有 UI-only 字段（如 accent, status, lastTakenAt, lastLog 等）
 * 
 * @export 导出供其他模块使用（如 sync.ts）
 */
export function sanitizeMedicationForDb(medication: Medication): any {
  // 数据库列白名单（根据 supabase schema）
  const dbFields = [
    'id',
    'user_id',
    'name',
    'dosage',
    'scheduled_time',
    'device_id',
    'updated_at'
  ];
  
  const sanitized: any = {};
  
  // 只保留白名单字段
  for (const field of dbFields) {
    if (field in medication || (field === 'updated_at' && !medication.updated_at)) {
      sanitized[field] = (medication as any)[field];
    }
  }
  
  // 确保必要字段存在
  if (!sanitized.updated_at) {
    sanitized.updated_at = new Date().toISOString();
  }
  
  // 显式删除 UI-only 字段（防御性编程）
  delete sanitized.accent;
  delete sanitized.status;
  delete sanitized.lastTakenAt;
  delete sanitized.lastLog;
  delete sanitized.uploadedAt;
  
  return sanitized;
}

/**
 * 添加或更新药品（直接写入云端）
 */
export async function upsertMedicationToCloud(medication: Medication): Promise<Medication | null> {
  const userId = await getCurrentUserId();
  if (!userId || !supabase) {
    console.error('❌ 用户未登录或 Supabase 未配置');
    return null;
  }

  try {
    const deviceId = getDeviceId();
    
    // 【修复 PGRST204】写入前 sanitize，删除 UI-only 字段
    const medicationData = sanitizeMedicationForDb({
      ...medication,
      user_id: userId,
      device_id: deviceId,
      updated_at: new Date().toISOString()
    });

    // 如果有 id，使用 upsert；否则 insert
    if (medication.id) {
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cloudOnly.ts:upsertMedicationToCloud:beforeUpsert',message:'Before upsert',data:{medicationId:medication.id,name:medication.name},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D1'})}).catch(()=>{});
      // #endregion
      
      const { data, error } = await supabase
        .from('medications')
        .upsert(medicationData, { onConflict: 'id' })
        .select()
        .single();

      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cloudOnly.ts:upsertMedicationToCloud:afterUpsert',message:'After upsert',data:{hasData:!!data,hasError:!!error,errorMsg:error?.message||'none',errorCode:error?.code||'none',dataLength:Array.isArray(data)?data.length:(data?1:0)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D1'})}).catch(()=>{});
      // #endregion

      if (error) {
        const errorMsg = error.message || `错误代码: ${error.code || 'unknown'}`;
        console.error('❌ 更新药品失败:', errorMsg, error);
        throw new Error(`更新药品失败: ${errorMsg}`);
      }

      console.log('✅ 药品已更新到云端:', data.name);
      return data;
    } else {
      // 新增药品，让数据库自动生成 UUID
      const { id, ...insertData } = medicationData;
      const { data, error } = await supabase
        .from('medications')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        const errorMsg = error.message || `错误代码: ${error.code || 'unknown'}`;
        console.error('❌ 添加药品失败:', errorMsg, error);
        throw new Error(`添加药品失败: ${errorMsg}`);
      }

      console.log('✅ 药品已添加到云端:', data.name);
      return data;
    }
  } catch (error: any) {
    console.error('❌ 保存药品异常:', error);
    // 重新抛出错误，让调用者可以显示具体错误消息
    throw error;
  }
}

/**
 * 删除药品（直接从云端删除）
 */
export async function deleteMedicationFromCloud(medicationId: string): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId || !supabase) {
    console.error('❌ 用户未登录或 Supabase 未配置');
    return false;
  }

  try {
    // 1. 删除药品（级联删除会自动删除相关记录）
    const { error } = await supabase
      .from('medications')
      .delete()
      .eq('id', medicationId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ 删除药品失败:', error);
      return false;
    }

    console.log('✅ 药品已从云端删除');
    return true;
  } catch (error) {
    console.error('❌ 删除药品异常:', error);
    return false;
  }
}

/**
 * 添加服药记录（直接写入云端）
 */
export async function addLogToCloud(log: Omit<MedicationLog, 'id'>): Promise<MedicationLog | null> {
  const userId = await getCurrentUserId();
  if (!userId || !supabase) {
    console.error('❌ 用户未登录或 Supabase 未配置');
    return null;
  }

  try {
    const deviceId = getDeviceId();
    const logData = {
      ...log,
      user_id: userId,
      device_id: deviceId,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('medication_logs')
      .insert(logData)
      .select()
      .single();

    if (error) {
      console.error('❌ 添加服药记录失败:', error);
      return null;
    }

    console.log('✅ 服药记录已添加到云端');
    return data;
  } catch (error) {
    console.error('❌ 添加服药记录异常:', error);
    return null;
  }
}

/**
 * 初始化 Realtime 监听（仅监听其他设备的变更）
 */
// 【彻底单例】全局启动门闩，保护整个启动流程
let realtimeStartupLatch: {
  isStarting: boolean;
  userId: string | null;
  promise: Promise<() => void> | null;
} = {
  isStarting: false,
  userId: null,
  promise: null
};

// Realtime 单例管理
let realtimeInstance: {
  userId: string;
  cleanup: () => void;
} | null = null;

// 事件防抖和去重
let medDebounceTimer: number | null = null;
let logDebounceTimer: number | null = null;
const processedMedIds = new Set<string>();
const processedLogIds = new Set<string>();
const MED_DEBOUNCE_MS = 400;
const LOG_DEBOUNCE_MS = 400;
const MAX_PROCESSED_IDS = 100; // 防止内存泄漏

export async function initCloudOnlyRealtime(callbacks: {
  onMedicationChange: () => void;
  onLogChange: () => void;
}): Promise<() => void> {
  // 【彻底单例】同步检查启动门闩，避免异步竞态条件
  if (realtimeStartupLatch.isStarting) {
    console.log('⏭️ Realtime 正在启动中，等待现有启动完成...', { 
      currentUserId: realtimeStartupLatch.userId 
    });
    // 等待现有启动完成
    if (realtimeStartupLatch.promise) {
      return await realtimeStartupLatch.promise;
    }
    // 如果 promise 不存在，说明启动失败，继续执行
  }

  if (!supabase) {
    console.warn('⚠️ Supabase 未配置，无法启动 Realtime');
    return () => {};
  }

  // 【彻底单例】获取 userId（同步检查）
  const userId = await getCurrentUserId();
  if (!userId) {
    console.warn('⚠️ 用户未登录，无法启动 Realtime');
    return () => {};
  }

  // 【彻底单例】检查已存在的实例（同步检查）
  if (realtimeInstance && realtimeInstance.userId === userId) {
    console.log('⏭️ Realtime 已存在，跳过重复初始化', { userId });
    return realtimeInstance.cleanup; // 返回现有的清理函数
  }

  // 【彻底单例】设置启动门闩
  realtimeStartupLatch.isStarting = true;
  realtimeStartupLatch.userId = userId;
  
  // 创建启动 Promise
  const startupPromise = (async () => {
    try {
      // 清理旧实例（如果存在）
      if (realtimeInstance) {
        realtimeInstance.cleanup();
        realtimeInstance = null;
      }

      const deviceId = getDeviceId();
  
  // 防抖包装函数
  const debouncedMedChange = () => {
    if (medDebounceTimer) {
      clearTimeout(medDebounceTimer);
    }
    medDebounceTimer = window.setTimeout(() => {
      medDebounceTimer = null;
      processedMedIds.clear(); // 清空已处理ID，允许同一ID再次触发
      callbacks.onMedicationChange();
    }, MED_DEBOUNCE_MS);
  };

  const debouncedLogChange = () => {
    if (logDebounceTimer) {
      clearTimeout(logDebounceTimer);
    }
    logDebounceTimer = window.setTimeout(() => {
      logDebounceTimer = null;
      processedLogIds.clear(); // 清空已处理ID
      callbacks.onLogChange();
    }, LOG_DEBOUNCE_MS);
  };
  
  // 监听 medications 表变更
  const medicationsChannel = supabase
    .channel('medications-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'medications'
      },
      (payload) => {
        const newRow = payload.new as any;
        // 过滤自身更新
        if (newRow?.device_id === deviceId) {
          return;
        }
        
        // 【去重】检查是否已处理过此 ID
        const medId = newRow?.id;
        if (medId && processedMedIds.has(medId)) {
          console.log('⏭️ 已处理过此药品变更，跳过', { medId });
          return;
        }
        
        // 记录已处理的 ID
        if (medId) {
          processedMedIds.add(medId);
          // 防止内存泄漏：限制 Set 大小
          if (processedMedIds.size > MAX_PROCESSED_IDS) {
            const firstId = Array.from(processedMedIds)[0];
            processedMedIds.delete(firstId);
          }
        }
        
        console.log('🔔 检测到其他设备的药品变更', { medId, eventType: payload.eventType });
        debouncedMedChange();
      }
    )
    .subscribe();

  // 监听 medication_logs 表变更
  const logsChannel = supabase
    .channel('medication-logs-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'medication_logs'
      },
      (payload) => {
        const newRow = payload.new as any;
        // 过滤自身更新
        if (newRow?.device_id === deviceId) {
          return;
        }
        
        // 【去重】检查是否已处理过此 ID
        const logId = newRow?.id;
        if (logId && processedLogIds.has(logId)) {
          console.log('⏭️ 已处理过此记录变更，跳过', { logId });
          return;
        }
        
        // 记录已处理的 ID
        if (logId) {
          processedLogIds.add(logId);
          // 防止内存泄漏
          if (processedLogIds.size > MAX_PROCESSED_IDS) {
            const firstId = Array.from(processedLogIds)[0];
            processedLogIds.delete(firstId);
          }
        }
        
        console.log('🔔 检测到其他设备的服药记录变更', { logId, eventType: payload.eventType });
        debouncedLogChange();
      }
    )
    .subscribe();

  console.log('✅ 纯云端 Realtime 已启动');

  // 清理函数
  const cleanup = () => {
    if (medDebounceTimer) {
      clearTimeout(medDebounceTimer);
      medDebounceTimer = null;
    }
    if (logDebounceTimer) {
      clearTimeout(logDebounceTimer);
      logDebounceTimer = null;
    }
    supabase.removeChannel(medicationsChannel);
    supabase.removeChannel(logsChannel);
    processedMedIds.clear();
    processedLogIds.clear();
    console.log('🔌 纯云端 Realtime 已停止');
  };

      // 保存单例实例
      realtimeInstance = { userId, cleanup };
      console.log('✅ Realtime 单例已创建', { userId });

      // 返回清理函数
      return cleanup;
    } finally {
      // 【彻底单例】清除启动门闩
      realtimeStartupLatch.isStarting = false;
      realtimeStartupLatch.userId = null;
      realtimeStartupLatch.promise = null;
    }
  })();

  // 保存 Promise 供其他调用等待
  realtimeStartupLatch.promise = startupPromise;

  return await startupPromise;
}

