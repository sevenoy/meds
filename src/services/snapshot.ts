/**
 * 云端快照管理服务
 * 基于云端同步技术文档完整实现
 * 支持：LWW冲突解决、自动同步、性能优化
 */

import { supabase, getCurrentUserId } from '../lib/supabase';
import { getMedications, getMedicationLogs, upsertMedication, deleteMedication, db, getDeviceId } from '../db/localDB';
import { getUserSettings, saveUserSettings } from './userSettings';

// Supabase 表名
const SNAPSHOT_TABLE = 'app_snapshots';
const SNAPSHOT_KEY = 'default';

// 本地存储键
const LAST_SYNC_TIME_KEY = 'meds_last_sync_time';
const LAST_SNAPSHOT_NAME_KEY = 'meds_last_snapshot_name';
const IS_DIRTY_KEY = 'meds_is_dirty'; // 本地是否有未保存修改

// 快照数据接口
export interface SnapshotPayload {
  ver: number;
  medications: any[];
  medication_logs: any[];
  user_settings: any;
  snapshot_label: string;
  __initialized?: boolean; // 初始化标记（Phase 4.5 添加）
}

// 全局状态
let isAutoSyncStarted = false;
let lastCheckedSnapshotName = '';

// 【1】全局同步保护标志（防止无限循环）
let isApplyingRemoteSnapshot = false;

// 【2】显式用户操作标志（最终修复）
let isUserAction = false;

// 【当前快照 payload 的内存变量】
let currentSnapshotPayload: SnapshotPayload | null = null;

/**
 * 在用户操作上下文中执行函数
 * 用于标记用户触发的操作，防止状态变化误判
 */
export function runWithUserAction(fn: () => void | Promise<void>): void | Promise<void> {
  isUserAction = true;
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(() => {
        setTimeout(() => {
          isUserAction = false;
        }, 0);
      });
    } else {
      setTimeout(() => {
        isUserAction = false;
      }, 0);
      return result;
    }
  } catch (error) {
    setTimeout(() => {
      isUserAction = false;
    }, 0);
    throw error;
  }
}

/**
 * 检查当前操作是否由用户触发
 */
export function isUserTriggered(): boolean {
  return isUserAction;
}

/**
 * 生成快照名称
 * 格式：用户名 YYYYMMDDHHmm
 */
function generateSnapshotName(userName: string, timestamp: string | Date): string {
  try {
    const d = new Date(timestamp);
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${userName} ${Y}${M}${D}${h}${m}`;
  } catch {
    return `${userName} ${Date.now()}`;
  }
}

/**
 * 获取最后同步的时间戳
 */
function getLastSyncTimestamp(): number {
  const savedTime = localStorage.getItem(LAST_SYNC_TIME_KEY);
  return savedTime ? parseInt(savedTime) : 0;
}

/**
 * 保存最后同步的时间戳
 */
function saveLastSyncTimestamp(timestamp: number): void {
  localStorage.setItem(LAST_SYNC_TIME_KEY, String(timestamp));
}

/**
 * 获取最后快照名称
 */
function getLastSnapshotName(): string {
  return localStorage.getItem(LAST_SNAPSHOT_NAME_KEY) || '';
}

/**
 * 保存最后快照名称
 */
function saveLastSnapshotName(name: string): void {
  if (name) {
    localStorage.setItem(LAST_SNAPSHOT_NAME_KEY, name);
  }
}

/**
 * 检查本地是否有未保存修改
 */
function isLocalDirty(): boolean {
  return localStorage.getItem(IS_DIRTY_KEY) === 'true';
}

/**
 * 标记本地为已保存
 */
function clearDirty(): void {
  localStorage.removeItem(IS_DIRTY_KEY);
}

/**
 * 标记本地为未保存
 */
function markDirty(): void {
  localStorage.setItem(IS_DIRTY_KEY, 'true');
}

/**
 * 标准化数据用于比较（忽略顺序和元数据）
 */
function normalizeMedication(med: any): any {
  if (!med) return null;
  return {
    name: String(med.name || '').trim(),
    dosage: String(med.dosage || '').trim(),
    scheduled_time: String(med.scheduled_time || '').trim(),
    accent: String(med.accent || '').trim()
  };
}

function normalizeLog(log: any): any {
  if (!log) return null;
  return {
    medication_id: String(log.medication_id || '').trim(),
    taken_at: String(log.taken_at || '').trim(),
    status: String(log.status || '').trim()
  };
}

/**
 * 比较两个数组是否相等（忽略顺序）
 */
function compareMedications(arr1: any[], arr2: any[]): boolean {
  if (arr1.length !== arr2.length) return false;
  
  const normalized1 = arr1.map(normalizeMedication).filter(Boolean).sort((a, b) => 
    (a.name + a.scheduled_time).localeCompare(b.name + b.scheduled_time)
  );
  const normalized2 = arr2.map(normalizeMedication).filter(Boolean).sort((a, b) => 
    (a.name + a.scheduled_time).localeCompare(b.name + b.scheduled_time)
  );
  
  return JSON.stringify(normalized1) === JSON.stringify(normalized2);
}

function compareLogs(arr1: any[], arr2: any[]): boolean {
  if (arr1.length !== arr2.length) return false;
  
  const normalized1 = arr1.map(normalizeLog).filter(Boolean).sort((a, b) => 
    (a.medication_id + a.taken_at).localeCompare(b.medication_id + b.taken_at)
  );
  const normalized2 = arr2.map(normalizeLog).filter(Boolean).sort((a, b) => 
    (a.medication_id + a.taken_at).localeCompare(b.medication_id + b.taken_at)
  );
  
  return JSON.stringify(normalized1) === JSON.stringify(normalized2);
}

function compareSettings(settings1: any, settings2: any): boolean {
  // 标准化设置对象（排序键）
  const normalize = (s: any) => {
    if (!s) return {};
    const normalized: any = {};
    Object.keys(s).sort().forEach(key => {
      const value = s[key];
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        normalized[key] = normalize(value);
      } else {
        normalized[key] = value;
      }
    });
    return normalized;
  };
  
  return JSON.stringify(normalize(settings1)) === JSON.stringify(normalize(settings2));
}

/**
 * 保存快照到云端 V2（Phase 3 实现 - 乐观锁版本）
 */
export async function cloudSaveV2(payload: SnapshotPayload): Promise<{
  success: boolean;
  version?: number;
  updated_at?: string;
  conflict?: boolean;
  message?: string;
}> {
  try {
    // 1. 检查 Supabase 是否配置
    if (!supabase) {
      return { success: false, message: 'Supabase 未配置' };
    }

    // 2. 获取当前登录用户
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, message: '用户未登录' };
    }

    console.log('💾 cloudSaveV2() 开始保存，userId:', userId);

    // 3. 调用 cloudLoadV2() 获取当前云端 version（作为"本地 version"）
    const loadResult = await cloudLoadV2();
    if (!loadResult.success) {
      console.error('❌ 获取云端 version 失败:', loadResult.message);
      return { success: false, message: `获取版本失败: ${loadResult.message}` };
    }

    const currentVersion = loadResult.version || 1;
    console.log('📌 当前云端 version:', currentVersion);

    // 4. 执行 UPDATE（乐观锁）
    const deviceId = getDeviceId();
    const { data: updatedState, error: updateError } = await supabase
      .from('app_state')
      .update({
        payload: payload,
        version: currentVersion + 1,
        updated_by: deviceId
        // updated_at 由数据库 DEFAULT now() 自动设置
      })
      .eq('owner_id', userId)
      .eq('version', currentVersion) // 乐观锁：只有 version 匹配才更新
      .select('id, payload, version, updated_at, updated_by')
      .single();

    // 5. 检查更新结果
    if (updateError) {
      console.error('❌ UPDATE 操作失败:', updateError);
      return { success: false, message: `更新失败: ${updateError.message}` };
    }

    // 6. 如果 UPDATE 影响行数 = 0（data 为 null），返回冲突
    if (!updatedState) {
      console.warn('⚠️ cloudSaveV2() 检测到冲突：version 不匹配，更新失败');
      return { 
        success: false, 
        conflict: true, 
        message: '版本冲突：云端数据已被其他设备修改，请刷新后重试' 
      };
    }

    // 7. 成功时返回新 version 和 updated_at
    console.log('✅ cloudSaveV2() 保存成功:', {
      version: updatedState.version,
      updated_at: updatedState.updated_at,
      updated_by: updatedState.updated_by
    });

    // 【2】在 cloudSaveV2 成功后，更新 currentSnapshotPayload（deep clone）
    currentSnapshotPayload = JSON.parse(JSON.stringify(payload));

    return {
      success: true,
      version: updatedState.version || (currentVersion + 1),
      updated_at: updatedState.updated_at
    };

  } catch (error: any) {
    console.error('❌ cloudSaveV2() 异常:', error);
    return { success: false, message: `保存异常: ${error.message || '未知错误'}` };
  }
}

/**
 * 从云端读取快照 V2（Phase 2 实现）
 */
export async function cloudLoadV2(): Promise<{ 
  success: boolean; 
  payload?: any; 
  version?: number; 
  updated_at?: string;
  message?: string;
}> {
  try {
    // 1. 检查 Supabase 是否配置
    if (!supabase) {
      return { success: false, message: 'Supabase 未配置' };
    }

    // 2. 获取当前登录用户
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, message: '用户未登录' };
    }

    console.log('🔄 cloudLoadV2() 开始读取，userId:', userId);

    // 3. 查询 app_state 表
    const { data: existingState, error: queryError } = await supabase
      .from('app_state')
      .select('id, payload, version, updated_at, updated_by')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error('❌ 查询 app_state 失败:', queryError);
      return { success: false, message: `查询失败: ${queryError.message}` };
    }

    // 4. 如果查询结果为空，插入新记录
    if (!existingState) {
      console.log('📝 app_state 不存在，创建新记录...');
      
      const deviceId = getDeviceId();
      const { data: newState, error: insertError } = await supabase
        .from('app_state')
        .insert({
          owner_id: userId,
          payload: {},
          version: 1,
          updated_by: deviceId
        })
        .select('id, payload, version, updated_at, updated_by')
        .single();

      if (insertError) {
        console.error('❌ 插入 app_state 失败:', insertError);
        return { success: false, message: `插入失败: ${insertError.message}` };
      }

      console.log('✅ 新记录已创建，返回空 payload');
      const payload = newState.payload || {};
      
      // 【2】在 cloudLoadV2 成功后，正确赋值 currentSnapshotPayload（deep clone）
      currentSnapshotPayload = JSON.parse(JSON.stringify(payload)) as SnapshotPayload;
      
      return {
        success: true,
        payload: payload,
        version: newState.version || 1,
        updated_at: newState.updated_at
      };
    }

    // 5. 返回查询到的数据
    console.log('✅ cloudLoadV2() 读取成功:', {
      version: existingState.version,
      updated_at: existingState.updated_at,
      updated_by: existingState.updated_by
    });

    const payload = existingState.payload || {};
    
      // 【2】在 cloudLoadV2 成功后，正确赋值 currentSnapshotPayload（deep clone）
      currentSnapshotPayload = JSON.parse(JSON.stringify(payload)) as SnapshotPayload;

    return {
      success: true,
      payload: payload,
      version: existingState.version || 1,
      updated_at: existingState.updated_at
    };

  } catch (error: any) {
    console.error('❌ cloudLoadV2() 异常:', error);
    return { success: false, message: `读取异常: ${error.message || '未知错误'}` };
  }
}

/**
 * 应用云端快照到本地数据库（强制整体替换）
 * Phase 4.5: 防止重复添加药品
 */
export async function applySnapshot(payload: SnapshotPayload): Promise<void> {
  console.log('🔄 应用云端快照（全量替换）');

  // 【2】进入云端应用保护区
  isApplyingRemoteSnapshot = true;

  // 【6】最终保险：防止重复 ID
  const ids = (payload.medications || []).map((m: any) => m.id);
  const unique = new Set(ids);
  if (ids.length !== unique.size) {
    console.error('🚨 检测到重复药品 ID，已阻止应用', ids);
    isApplyingRemoteSnapshot = false; // 解除保护
    return;
  }

  try {
    // 【A】全量覆盖写入：先清空，后 bulkAdd
    console.log('🔄 开始全量覆盖写入（清空后 bulkAdd）');
    
    // 1. 清空所有现有数据（全量覆盖）
    await db.medications.clear();
    await db.medicationLogs.clear();
    console.log('✅ 已清空所有本地数据');
    
    // 2. 批量写入药物（全量覆盖，使用 bulkAdd）
    if (payload.medications && payload.medications.length > 0) {
      const medsToAdd = payload.medications.map((med: any) => ({
        ...med,
        sync_state: 'clean' // 从云端加载的记录标记为已同步
      }));
      await db.medications.bulkAdd(medsToAdd);
      console.log(`✅ 已批量添加 ${medsToAdd.length} 条药品记录`);
    }
    
    // 3. 批量写入记录（全量覆盖，使用 bulkAdd）
    if (payload.medication_logs && payload.medication_logs.length > 0) {
      const logsToAdd = payload.medication_logs.map((log: any) => {
        // 确保有 id
        if (!log.id) {
          log.id = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        return {
          ...log,
          sync_state: 'clean' // 从云端加载的记录标记为已同步
        };
      });
      await db.medicationLogs.bulkAdd(logsToAdd);
      console.log(`✅ 已批量添加 ${logsToAdd.length} 条服药记录`);
    }

    // 4. 更新用户设置
    if (payload.user_settings) {
      await saveUserSettings(payload.user_settings);
    }

    console.log('✅ 云端快照已应用到本地数据库（全量替换）');
    
    // 【2】在 applySnapshot 成功后，正确赋值 currentSnapshotPayload（deep clone）
    currentSnapshotPayload = JSON.parse(JSON.stringify(payload));
  } catch (error: any) {
    console.error('❌ 应用云端快照失败:', error);
    throw error;
  } finally {
    // 【2】延迟解除，确保所有 state 更新完成
    setTimeout(() => {
      isApplyingRemoteSnapshot = false;
      console.log('🛡 云端快照应用完成，解除保护');
    }, 0);
  }
}

/**
 * 获取当前快照 payload（用于添加/编辑/删除药品）
 */
export function getCurrentSnapshotPayload(): SnapshotPayload | null {
  return currentSnapshotPayload;
}

/**
 * 检查是否正在应用云端快照（用于防止循环调用）
 */
export function isApplyingSnapshot(): boolean {
  return isApplyingRemoteSnapshot;
}

/**
 * 检查是否正在应用云端回放（用于防止监听触发保存）
 */
export function isApplyingRemote(): boolean {
  return isApplyingRemoteSnapshot;
}

/**
 * 初始化 Realtime V2 订阅（Phase 4 实现）
 * 监听 app_state 表的 INSERT 和 UPDATE 事件
 * @returns 返回 unsubscribe 函数
 */
export async function initRealtimeV2(): Promise<() => void> {
  // 1. 检查 Supabase 是否配置
  if (!supabase) {
    console.warn('⚠️ Supabase 未配置，无法启动 Realtime V2');
    return () => {}; // 返回空函数
  }

  // 2. 获取当前登录用户
  const userId = await getCurrentUserId();
  if (!userId) {
    console.warn('⚠️ 用户未登录，无法启动 Realtime V2');
    return () => {}; // 返回空函数
  }

  // 3. 获取当前 deviceId（用于过滤自身更新）
  const currentDeviceId = getDeviceId();
  console.log('🔄 initRealtimeV2() 开始订阅，userId:', userId, 'deviceId:', currentDeviceId);

  // 4. 创建 Realtime 订阅
  const channel = supabase
    .channel('app-state-realtime-v2-' + userId)
    .on(
      'postgres_changes',
      {
        event: '*', // 监听 INSERT 和 UPDATE
        schema: 'public',
        table: 'app_state',
        filter: `owner_id=eq.${userId}` // 只监听当前用户的数据
      },
      async (payload) => {
        // 5. 处理数据库变更事件
        const newRow = payload.new as any;
        
        if (!newRow) {
          console.warn('⚠️ Realtime V2: 收到事件但 new 为空');
          return;
        }

        // 6. 打印日志（打印 new.version）
        console.log('📥 Realtime V2: 收到 app_state 更新事件', {
          eventType: payload.eventType,
          version: newRow.version,
          updated_at: newRow.updated_at,
          updated_by: newRow.updated_by
        });

        // 7. Phase 4.5: 过滤自身更新
        if (newRow.updated_by === currentDeviceId) {
          console.log('⏭ Realtime V2: 忽略自身更新（updated_by === 当前 deviceId）');
          return;
        }

        // 8. 只有非自身更新，才调用 cloudLoadV2() 拉取最新数据
        try {
          console.log('🔄 Realtime V2: 开始拉取最新数据...');
          const loadResult = await cloudLoadV2();
          
          if (loadResult.success && loadResult.payload) {
            console.log('✅ Realtime V2: 拉取完成', {
              version: loadResult.version,
              updated_at: loadResult.updated_at
            });
            
            // 【2】强制修复：使用整体替换，不使用 push/merge
            const payload = loadResult.payload as SnapshotPayload;
            await applySnapshot(payload);
          } else {
            console.error('❌ Realtime V2: 拉取失败', loadResult.message);
          }
        } catch (error: any) {
          console.error('❌ Realtime V2: 拉取异常', error);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Realtime V2: 订阅成功，开始监听 app_state 变化');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('❌ Realtime V2: 订阅失败', status);
      } else {
        console.log('🔄 Realtime V2: 订阅状态', status);
      }
    });

  // 7. 保存 channel 引用，防止被垃圾回收
  (window as any)._appStateRealtimeV2Channel = channel;

  // 8. 返回清理函数
  return () => {
    console.log('🔌 initRealtimeV2() 断开订阅');
    if (channel) {
      supabase.removeChannel(channel);
    }
    delete (window as any)._appStateRealtimeV2Channel;
  };
}

/**
 * 保存快照到云端（Legacy - 完整实现 - 基于技术文档）
 */
export async function saveSnapshotLegacy(): Promise<{ success: boolean; message: string }> {
  try {
    // 检查 Supabase 是否配置
    if (!supabase) {
      return { success: false, message: 'Supabase 未配置，无法保存快照' };
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, message: '用户未登录' };
    }

    console.log('📊 开始保存快照...');

    // 1. 获取当前用户设置中的用户名
    const settings = await getUserSettings();
    const userName = settings.userName || '未知用户';

    // 2. 获取本地数据
    const medications = await getMedications();
    const medicationLogs = await getMedicationLogs();
    const userSettings = settings;

    console.log('📊 本地数据:', {
      medications: medications.length,
      logs: medicationLogs.length
    });

    // 3. 查询云端最新快照（优化：只查询必要字段）
    const { data: cloudData, error: queryError } = await supabase
      .from(SNAPSHOT_TABLE)
      .select('payload, updated_at, updated_by_name')
      .eq('key', SNAPSHOT_KEY)
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error('❌ 查询云端数据失败:', queryError);
      return { success: false, message: `查询失败: ${queryError.message}` };
    }

    const lastSyncTimestamp = getLastSyncTimestamp();

    // 4. 检查云端是否有更新（冲突检测）
    if (cloudData) {
      const cloudTime = new Date(cloudData.updated_at).getTime();
      
      if (cloudTime > lastSyncTimestamp) {
        // 云端数据更新，检查数据内容是否相同
        const cloudPayload = cloudData.payload as SnapshotPayload;
        
        const medicationsEqual = compareMedications(medications, cloudPayload.medications || []);
        const logsEqual = compareLogs(medicationLogs, cloudPayload.medication_logs || []);
        const settingsEqual = compareSettings(userSettings, cloudPayload.user_settings || {});
        
        if (medicationsEqual && logsEqual && settingsEqual) {
          // 数据内容相同，只更新时间戳（无需保存）
          saveLastSyncTimestamp(cloudTime);
          const cloudSnapshotName = cloudPayload.snapshot_label || 
            generateSnapshotName(cloudData.updated_by_name || userName, cloudData.updated_at);
          saveLastSnapshotName(cloudSnapshotName);
          
          console.log('✅ 数据未改动，已更新时间戳');
          return { success: false, message: '数据未改动，无需保存' };
        } else {
          // 数据内容不同，发生冲突（LWW策略：自动加载最新数据）
          const cloudUpdater = cloudData.updated_by_name || '其他设备';
          const cloudUpdateTime = new Date(cloudData.updated_at).toLocaleString('zh-CN');
          
          console.warn('⚠️ 检测到冲突，云端数据更新');
          
          // 自动加载云端最新数据
          await loadSnapshotLegacy(true); // 静默加载
          
          return {
            success: false,
            message: `⚠️ 检测到冲突！\n\n云端数据已被 "${cloudUpdater}" 在 ${cloudUpdateTime} 更新。\n\n已自动加载最新数据，请重新修改后保存。`
          };
        }
      }
    }

    // 5. 生成快照名称
    const now = new Date();
    const snapshotName = generateSnapshotName(userName, now);

    // 6. 构建快照数据
    const payload: SnapshotPayload = {
      ver: 1,
      medications: medications,
      medication_logs: medicationLogs,
      user_settings: userSettings,
      snapshot_label: snapshotName
    };

    // 7. 保存到云端（使用 upsert，onConflict 处理）
    const { data: saved, error: saveError } = await supabase
      .from(SNAPSHOT_TABLE)
      .upsert({
        key: SNAPSHOT_KEY,
        owner_id: userId,
        payload: payload,
        updated_at: now.toISOString(),
        updated_by_name: userName
      }, { 
        onConflict: 'key,owner_id' 
      })
      .select('updated_at')
      .single();

    if (saveError) {
      console.error('❌ 保存快照失败:', saveError);
      return { success: false, message: `保存失败: ${saveError.message}` };
    }

    // 8. 更新本地时间戳和快照名称
    const serverTime = new Date(saved.updated_at).getTime();
    saveLastSyncTimestamp(serverTime);
    saveLastSnapshotName(snapshotName);
    clearDirty(); // 标记为已保存

    console.log('✅ 快照保存成功:', snapshotName);

    return {
      success: true,
      message: `✅ 快照已保存！\n\n快照名称: ${snapshotName}\n保存时间: ${new Date(saved.updated_at).toLocaleString('zh-CN')}`
    };

  } catch (error: any) {
    console.error('❌ 保存快照异常:', error);
    return { success: false, message: `保存异常: ${error.message}` };
  }
}

/**
 * 从云端读取快照（Legacy - 完整实现 - 基于技术文档）
 */
export async function loadSnapshotLegacy(silent: boolean = false): Promise<{ success: boolean; message: string; payload?: SnapshotPayload }> {
  try {
    // 检查 Supabase 是否配置
    if (!supabase) {
      return { success: false, message: 'Supabase 未配置，无法读取快照' };
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, message: '用户未登录' };
    }

    // 1. 检查本地是否有未保存修改（非静默模式）
    if (!silent && isLocalDirty()) {
      const ok = confirm('本地有未保存修改，加载云端数据将覆盖本地修改，是否继续？');
      if (!ok) {
        return { success: false, message: '用户取消加载' };
      }
    }

    console.log('🔍 正在读取云端快照...');

    // 2. 更新 lastSyncTimestamp（从 localStorage 重新读取，确保多标签页同步）
    const savedTime = localStorage.getItem(LAST_SYNC_TIME_KEY);
    const currentLastSync = savedTime ? parseInt(savedTime) : 0;

    // 3. 查询云端数据
    const { data: cloudData, error } = await supabase
      .from(SNAPSHOT_TABLE)
      .select('payload, updated_at, updated_by_name')
      .eq('key', SNAPSHOT_KEY)
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ 读取快照失败:', error);
      return { success: false, message: `读取失败: ${error.message}` };
    }

    if (!cloudData) {
      if (!silent) {
        return { success: false, message: '云端暂无快照数据' };
      }
      return { success: false, message: '' };
    }

    const serverTime = new Date(cloudData.updated_at).getTime();

    // 4. 时间戳检查（静默加载时）
    if (silent && serverTime <= currentLastSync) {
      console.log('ℹ️ 云端数据不比本地新，跳过加载');
      return { success: false, message: '' };
    }

    // 5. 解析快照数据
    const payload = cloudData.payload as SnapshotPayload;
    
    // 6. 写入本地数据库（批量操作，优化性能）
    try {
      // 6.1 清空现有数据
      const existingMeds = await getMedications();
      const existingLogs = await getMedicationLogs();
      
      // 删除不存在的药物
      const cloudMedIds = new Set((payload.medications || []).map((m: any) => m.id));
      for (const med of existingMeds) {
        if (!cloudMedIds.has(med.id)) {
          await deleteMedication(med.id);
        }
      }
      
      // 6.2 批量写入药物（使用 upsert）
      if (payload.medications && payload.medications.length > 0) {
        for (const med of payload.medications) {
          await upsertMedication(med);
        }
      }
      
      // 6.3 批量写入记录（使用 put 实现 upsert）
      if (payload.medication_logs && payload.medication_logs.length > 0) {
        for (const log of payload.medication_logs) {
          // 确保有 id
          if (!log.id) {
            log.id = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          }
          // 使用 put 实现 upsert（如果存在则更新，不存在则添加）
          await db.medicationLogs.put({
            ...log,
            sync_state: 'clean' // 从云端加载的记录标记为已同步
          });
        }
      }
      
      // 6.4 更新用户设置
      if (payload.user_settings) {
        await saveUserSettings(payload.user_settings);
      }
      
      console.log('✅ 数据已写入本地数据库');
    } catch (writeError: any) {
      console.error('❌ 数据写入失败:', writeError);
      // iOS Safari 兼容性：重试一次
      if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        console.log('🔄 iOS设备，重试写入...');
        await new Promise(resolve => setTimeout(resolve, 500));
        // 简化重试：只写入关键数据
        if (payload.medications) {
          for (const med of payload.medications) {
            await upsertMedication(med);
          }
        }
      } else {
        throw writeError;
      }
    }

    // 7. 更新本地时间戳和快照名称
    saveLastSyncTimestamp(serverTime);
    const snapshotName = payload.snapshot_label || 
      generateSnapshotName(cloudData.updated_by_name || '未知用户', cloudData.updated_at);
    saveLastSnapshotName(snapshotName);
    clearDirty(); // 标记为已保存

    const updateTime = new Date(cloudData.updated_at).toLocaleString('zh-CN');
    const updater = cloudData.updated_by_name || '未知用户';

    console.log('✅ 快照读取成功:', snapshotName);

    return {
      success: true,
      message: `✅ 快照读取成功！\n\n快照名称: ${snapshotName}\n保存者: ${updater}\n保存时间: ${updateTime}`,
      payload: payload
    };

  } catch (error: any) {
    console.error('❌ 读取快照异常:', error);
    return { success: false, message: `读取异常: ${error.message}` };
  }
}

/**
 * 获取快照信息（不加载数据）
 */
export async function getSnapshotInfo(): Promise<{
  local: string;
  cloud: string;
  hasUpdate: boolean;
}> {
  try {
    if (!supabase) {
      return { local: '未配置', cloud: '未配置', hasUpdate: false };
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      return { local: '未登录', cloud: '未知', hasUpdate: false };
    }

    const localSnapshot = getLastSnapshotName() || '未保存';

    const { data } = await supabase
      .from(SNAPSHOT_TABLE)
      .select('payload, updated_at')
      .eq('key', SNAPSHOT_KEY)
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      return { local: localSnapshot, cloud: '云端无快照', hasUpdate: false };
    }

    const cloudSnapshot = (data.payload as SnapshotPayload).snapshot_label || '未知快照';
    const cloudTime = new Date(data.updated_at).getTime();
    const lastSyncTime = getLastSyncTimestamp();
    const hasUpdate = cloudTime > lastSyncTime;

    return {
      local: localSnapshot,
      cloud: cloudSnapshot,
      hasUpdate: hasUpdate
    };

  } catch (error) {
    console.error('❌ 获取快照信息失败:', error);
    return { local: '错误', cloud: '错误', hasUpdate: false };
  }
}

/**
 * 初始化自动同步（Legacy - Realtime监听快照变化）
 */
export async function initAutoSyncLegacy(onSnapshotUpdate?: () => void): Promise<() => void> {
  // 1. 检查是否已启动
  if (isAutoSyncStarted) {
    console.log('自动同步已启动，跳过重复初始化');
    return () => {};
  }

  // 2. 检查 Supabase 和用户登录状态
  if (!supabase) {
    console.warn('Supabase 未配置，无法启动自动同步');
    return () => {};
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    console.warn('用户未登录，无法启动自动同步');
    return () => {};
  }

  isAutoSyncStarted = true;

  // 3. 初始化时间戳和快照名称
  const savedTime = localStorage.getItem(LAST_SYNC_TIME_KEY);
  if (savedTime) {
    saveLastSyncTimestamp(parseInt(savedTime));
  }

  const lastSnapshotName = getLastSnapshotName();

  // 4. 如果没有保存的快照名称，尝试从云端获取
  if (!lastSnapshotName) {
    try {
      const { data } = await supabase
        .from(SNAPSHOT_TABLE)
        .select('payload, updated_at, updated_by_name')
        .eq('key', SNAPSHOT_KEY)
        .eq('owner_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && data.payload) {
        const snapshotName = (data.payload as SnapshotPayload).snapshot_label || 
          generateSnapshotName(data.updated_by_name || '未知用户', data.updated_at);
        saveLastSnapshotName(snapshotName);
      }
    } catch (err) {
      console.warn('初始化时获取快照名称失败:', err);
    }
  }

  // 5. 创建 Realtime 订阅
  const channel = supabase
    .channel('meds-auto-sync-' + userId)
    .on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: SNAPSHOT_TABLE, 
        filter: `key=eq.${SNAPSHOT_KEY} AND owner_id=eq.${userId}`
      },
      async (evt) => {
        // 6. 处理数据库变更事件
        const newRow = evt.new as any;
        if (!newRow) return;

        const serverTime = new Date(newRow.updated_at).getTime();

        // 7. 更新 lastSyncTimestamp（从 localStorage 重新读取，确保多标签页同步）
        const savedTime = localStorage.getItem(LAST_SYNC_TIME_KEY);
        const currentLastSync = savedTime ? parseInt(savedTime) : 0;

        // 8. 获取当前快照名称
        const currentSnapshotName = getLastSnapshotName();

        // 9. 生成新的快照名称（用于比较）
        const newSnapshotName = (newRow.payload as SnapshotPayload)?.snapshot_label || 
          generateSnapshotName(newRow.updated_by_name || '未知用户', newRow.updated_at);

        // 10. 关键检测：快照名称是否改变（这是检测新快照的主要方式）
        const snapshotNameChanged = currentSnapshotName !== newSnapshotName;

        // 11. 如果快照名称改变，说明有新快照，需要更新
        if (!snapshotNameChanged && serverTime <= currentLastSync) {
          console.log('快照名称未改变且时间戳不比本地新，跳过自动同步');
          return;
        }

        // 12. 快照名称改变或时间戳更新，需要同步
        const who = newRow.updated_by_name || '其他设备';

        if (isLocalDirty()) {
          // 本地有未保存修改，弹出提示要求用户更新
          const ok = confirm(
            `检测到最新快照已更新\n\n"${who}" 刚刚保存了新快照。\n\n` +
            `点击【确定】自动加载最新快照（本地未保存的修改将被覆盖）\n\n` +
            `点击【取消】稍后手动加载`
          );
          if (ok) {
            saveLastSyncTimestamp(0); // 重置时间戳，强制加载
            await loadSnapshotLegacy(false);
            if (onSnapshotUpdate) onSnapshotUpdate();
          } else {
            // 显示提示
            const notification = document.createElement('div');
            notification.className = 'fixed top-4 right-4 z-50 bg-orange-500 text-white px-6 py-3 rounded-full font-bold text-sm shadow-lg';
            notification.textContent = `${who} 更新了快照，请稍后手动加载`;
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
          }
          return;
        }

        // 13. 本地没有未保存修改，弹出提示并自动加载最新数据
        const ok = confirm(
          `检测到最新快照已更新\n\n"${who}" 刚刚保存了新快照。\n\n` +
          `点击【确定】自动加载最新快照\n\n` +
          `点击【取消】稍后手动加载`
        );

        if (ok) {
          saveLastSyncTimestamp(0); // 重置时间戳，强制加载
          await loadSnapshot(false);
          if (onSnapshotUpdate) onSnapshotUpdate();
        } else {
          // 显示提示
          const notification = document.createElement('div');
          notification.className = 'fixed top-4 right-4 z-50 bg-blue-500 text-white px-6 py-3 rounded-full font-bold text-sm shadow-lg';
          notification.textContent = `${who} 更新了快照，请稍后手动加载`;
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 3000);
        }
      }
    )
    .subscribe((status) => {
      console.log('Realtime 订阅状态:', status);
      if (status === 'SUBSCRIBED') {
        console.log('✅ Realtime 订阅成功，开始监听快照变化');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('❌ Realtime 订阅失败');
      }
    });

  // 14. 保存 channel 引用，防止被垃圾回收
  (window as any)._snapshotSyncChannel = channel;

  // 返回清理函数
  return () => {
    console.log('🔌 断开快照自动同步');
    supabase.removeChannel(channel);
    isAutoSyncStarted = false;
  };
}

/**
 * 标记本地数据为已修改（在数据变更时调用）
 */
export function markLocalDataDirty(): void {
  markDirty();
}

// ============================================
// 向后兼容导出（保持旧函数名可用）
// ============================================

/**
 * @deprecated 使用 saveSnapshotLegacy 或 cloudSaveV2
 */
export const saveSnapshot = saveSnapshotLegacy;

/**
 * @deprecated 使用 loadSnapshotLegacy 或 cloudLoadV2
 */
export const loadSnapshot = loadSnapshotLegacy;

/**
 * @deprecated 使用 initAutoSyncLegacy
 */
export const initAutoSync = initAutoSyncLegacy;
