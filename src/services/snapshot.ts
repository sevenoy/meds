/**
 * 云端快照管理服务
 * 基于云端同步技术文档实现
 */

import { supabase, getCurrentUserId } from '../lib/supabase';
import { getMedications, getMedicationLogs } from '../db/localDB';
import { getUserSettings } from './userSettings';

// Supabase 表名
const SNAPSHOT_TABLE = 'app_snapshots';
const SNAPSHOT_KEY = 'default';

// 本地存储键
const LAST_SYNC_TIME_KEY = 'meds_last_sync_time';
const LAST_SNAPSHOT_NAME_KEY = 'meds_last_snapshot_name';

// 快照数据接口
export interface SnapshotPayload {
  ver: number;
  medications: any[];
  medication_logs: any[];
  user_settings: any;
  snapshot_label: string;
}

/**
 * 生成快照名称
 * 格式：用户名 YYYYMMDDHHmm
 */
function generateSnapshotName(userName: string, timestamp: string | Date): string {
  const d = new Date(timestamp);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${userName} ${Y}${M}${D}${h}${m}`;
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
  localStorage.setItem(LAST_SNAPSHOT_NAME_KEY, name);
}

/**
 * 比较两个数组是否相等（忽略顺序）
 */
function arraysEqual(arr1: any[], arr2: any[]): boolean {
  if (arr1.length !== arr2.length) return false;
  
  const normalized1 = arr1.map(item => JSON.stringify(item)).sort();
  const normalized2 = arr2.map(item => JSON.stringify(item)).sort();
  
  return JSON.stringify(normalized1) === JSON.stringify(normalized2);
}

/**
 * 保存快照到云端（带冲突检测）
 */
export async function saveSnapshot(): Promise<{ success: boolean; message: string }> {
  try {
    // 检查 Supabase 是否配置
    if (!supabase) {
      return { success: false, message: 'Supabase 未配置，无法保存快照' };
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, message: '用户未登录' };
    }

    // 1. 获取当前用户设置中的用户名
    const settings = await getUserSettings();
    const userName = settings.userName || '未知用户';

    // 2. 获取本地数据
    const medications = await getMedications();
    const medicationLogs = await getMedicationLogs();
    const userSettings = settings;

    console.log('📊 准备保存快照:', {
      medications: medications.length,
      logs: medicationLogs.length
    });

    // 3. 查询云端最新快照
    const { data: cloudData } = await supabase!
      .from(SNAPSHOT_TABLE)
      .select('payload, updated_at, updated_by_name')
      .eq('key', SNAPSHOT_KEY)
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastSyncTimestamp = getLastSyncTimestamp();

    // 4. 检查云端是否有更新（冲突检测）
    if (cloudData) {
      const cloudTime = new Date(cloudData.updated_at).getTime();
      
      if (cloudTime > lastSyncTimestamp) {
        // 云端数据更新，检查数据是否相同
        const cloudPayload = cloudData.payload as SnapshotPayload;
        
        const medicationsEqual = arraysEqual(medications, cloudPayload.medications || []);
        const logsEqual = arraysEqual(medicationLogs, cloudPayload.medication_logs || []);
        const settingsEqual = JSON.stringify(userSettings) === JSON.stringify(cloudPayload.user_settings || {});
        
        if (medicationsEqual && logsEqual && settingsEqual) {
          // 数据内容相同，只更新时间戳
          saveLastSyncTimestamp(cloudTime);
          return { success: false, message: '数据未改动，无需保存' };
        } else {
          // 数据内容不同，发生冲突
          const cloudUpdater = cloudData.updated_by_name || '其他设备';
          const cloudUpdateTime = new Date(cloudData.updated_at).toLocaleString('zh-CN');
          
          return {
            success: false,
            message: `⚠️ 检测到冲突！\n\n云端数据已被 "${cloudUpdater}" 在 ${cloudUpdateTime} 更新。\n\n请先点击【云端读取】加载最新数据，然后重新修改并保存。`
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

    // 7. 保存到云端
    const { data: saved, error } = await supabase!
      .from(SNAPSHOT_TABLE)
      .upsert({
        key: SNAPSHOT_KEY,
        owner_id: userId,
        payload: payload,
        updated_at: now.toISOString(),
        updated_by_name: userName
      }, { onConflict: 'key,owner_id' })
      .select('updated_at')
      .single();

    if (error) {
      console.error('❌ 保存快照失败:', error);
      return { success: false, message: `保存失败: ${error.message}` };
    }

    // 8. 更新本地时间戳和快照名称
    const serverTime = new Date(saved.updated_at).getTime();
    saveLastSyncTimestamp(serverTime);
    saveLastSnapshotName(snapshotName);

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
 * 从云端读取快照
 */
export async function loadSnapshot(): Promise<{ success: boolean; message: string; payload?: SnapshotPayload }> {
  try {
    // 检查 Supabase 是否配置
    if (!supabase) {
      return { success: false, message: 'Supabase 未配置，无法读取快照' };
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, message: '用户未登录' };
    }

    console.log('🔍 正在读取云端快照...');

    // 1. 查询云端最新快照
    const { data: cloudData, error } = await supabase!
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
      return { success: false, message: '云端暂无快照数据' };
    }

    // 2. 解析快照数据
    const payload = cloudData.payload as SnapshotPayload;
    const snapshotName = payload.snapshot_label || '未知快照';
    const updateTime = new Date(cloudData.updated_at).toLocaleString('zh-CN');
    const updater = cloudData.updated_by_name || '未知用户';

    console.log('📥 读取到云端快照:', {
      name: snapshotName,
      medications: payload.medications?.length || 0,
      logs: payload.medication_logs?.length || 0
    });

    // 3. 更新本地时间戳和快照名称
    const serverTime = new Date(cloudData.updated_at).getTime();
    saveLastSyncTimestamp(serverTime);
    saveLastSnapshotName(snapshotName);

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
    // 检查 Supabase 是否配置
    if (!supabase) {
      return { local: '未配置', cloud: '未配置', hasUpdate: false };
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      return { local: '未登录', cloud: '未知', hasUpdate: false };
    }

    const localSnapshot = getLastSnapshotName() || '未保存';

    const { data } = await supabase!
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
