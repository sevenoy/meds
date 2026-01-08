/**
 * Realtime 实时同步服务
 * 基于 Supabase Realtime 实现多设备即时数据同步
 */

import { supabase, getCurrentUserId } from '../lib/supabase';
import { getDeviceId } from '../db/localDB';
import type { RealtimeChannel } from '@supabase/supabase-js';

// 全局状态
let realtimeChannel: RealtimeChannel | null = null;
let isApplyingRemote = false; // 防止循环更新标志
let connectionStatus: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
let reconnecting = false;

let medChangeTimer: number | null = null;
let logChangeTimer: number | null = null;
let settingsChangeTimer: number | null = null;

function shouldSendDebugIngest(): boolean {
  try {
    // eslint-disable-next-line no-undef
    if (!(import.meta as any)?.env?.DEV) return false;
  } catch {
    return false;
  }
  return localStorage.getItem('debug_ingest') === 'true';
}

function debounceCall(timerRef: 'med' | 'log' | 'settings', fn: () => void, delayMs: number): void {
  const clear = (t: number | null) => {
    if (t !== null) window.clearTimeout(t);
  };

  if (timerRef === 'med') {
    clear(medChangeTimer);
    medChangeTimer = window.setTimeout(fn, delayMs);
    return;
  }
  if (timerRef === 'log') {
    clear(logChangeTimer);
    logChangeTimer = window.setTimeout(fn, delayMs);
    return;
  }
  clear(settingsChangeTimer);
  settingsChangeTimer = window.setTimeout(fn, delayMs);
}

// 回调函数类型
interface RealtimeCallbacks {
  onMedicationChange?: () => void;
  onLogChange?: () => void;
  onSettingsChange?: () => void;
  onConnectionStatusChange?: (status: 'connected' | 'disconnected' | 'connecting') => void;
}

/**
 * 初始化 Realtime 同步
 * @param callbacks 各种数据变更的回调函数
 * @returns 清理函数
 */
export async function initRealtimeSync(callbacks: RealtimeCallbacks): Promise<() => void> {
  try {
    const userId = await getCurrentUserId();
    
    if (!userId) {
      console.warn('[Realtime] 未登录，跳过 Realtime 初始化');
      return () => {};
    }
    
    const deviceId = getDeviceId();
    console.log('[Realtime] 初始化同步服务', { userId, deviceId });
    
    // 如果已有连接，先清理
    if (realtimeChannel) {
      await cleanupRealtimeSync();
    }
    
    // 更新连接状态
    updateConnectionStatus('connecting', callbacks);
    
    // 创建唯一频道
    
    realtimeChannel = supabase
      .channel(`meds_sync_${deviceId}`, {
        config: {
          broadcast: { self: false }, // 不接收自己发送的消息
        }
      })
      // 订阅药品表变更
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'medications',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        // 【性能优化】先检查是否是自己设备的更新，避免不必要的日志输出
        const newData = payload.new as any;
        if (newData && newData.device_id === deviceId) {
          // 完全静默忽略自己设备的更新，不输出任何日志
          return;
        }
        
        // 只有其他设备的更新才输出日志
        console.log('[Realtime] 药品变更（其他设备）', {
          eventType: payload.eventType,
          medicationId: newData?.id,
          deviceId: newData?.device_id
        });        
        if (!isApplyingRemote && callbacks.onMedicationChange) {          // 关键：合并同一批次的多条变更，避免 1 分钟 2000 次回调/同步
          debounceCall('med', callbacks.onMedicationChange, 300);
        } else {        }
      })
      // 订阅服药记录表变更（与 medications 完全一致的机制）
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'medication_logs',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        // 【性能优化】先检查是否是自己设备的更新
        const newData = payload.new as any;
        if (newData && newData.device_id === deviceId) {
          // 完全静默忽略自己设备的更新
          return;
        }
        
        console.log('[Realtime] 服药记录变更（其他设备）', {
          eventType: payload.eventType,
          logId: newData?.id,
          deviceId: newData?.device_id
        });
        
        // 【一致性修复】与 medications 完全一致：统一触发 reloadLogs，不局部 patch state
        if (!isApplyingRemote && callbacks.onLogChange) {
          debounceCall('log', callbacks.onLogChange, 300);
        }
      })
      // 订阅用户设置表变更
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_settings',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        // 【性能优化】先检查是否是自己设备的更新
        const newData = payload.new as any;
        if (newData && newData.device_id === deviceId) {
          // 完全静默忽略自己设备的更新
          return;
        }
        
        console.log('[Realtime] 用户设置变更（其他设备）', {
          eventType: payload.eventType,
          deviceId: newData?.device_id
        });
        
        if (!isApplyingRemote && callbacks.onSettingsChange) {
          debounceCall('settings', callbacks.onSettingsChange, 300);
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] 订阅状态:', status);
        
        if (status === 'SUBSCRIBED') {
          updateConnectionStatus('connected', callbacks);
          reconnecting = false;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          updateConnectionStatus('disconnected', callbacks);
          // 自动重连
          if (!reconnecting) {
            reconnecting = true;
            setTimeout(() => {
              console.log('[Realtime] 尝试重新连接...');
              initRealtimeSync(callbacks);
            }, 5000);
          }
        }
      });
    
    // 返回清理函数
    return () => cleanupRealtimeSync();
  } catch (error) {
    console.error('[Realtime] 初始化失败:', error);
    updateConnectionStatus('disconnected', callbacks);
    return () => {};
  }
}

/**
 * 清理 Realtime 连接
 */
export async function cleanupRealtimeSync(): Promise<void> {
  if (realtimeChannel) {
    console.log('[Realtime] 清理连接');
    await supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
    connectionStatus = 'disconnected';
  }
}

/**
 * 更新连接状态
 */
function updateConnectionStatus(
  status: 'connected' | 'disconnected' | 'connecting',
  callbacks: RealtimeCallbacks
): void {
  connectionStatus = status;
  if (callbacks.onConnectionStatusChange) {
    callbacks.onConnectionStatusChange(status);
  }
}

/**
 * 获取当前连接状态
 */
export function getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
  return connectionStatus;
}

/**
 * 在远程更新上下文中执行函数
 * 用于标记远程触发的更新，防止循环
 */
export async function runWithRemoteFlag(fn: () => Promise<void>): Promise<void> {  isApplyingRemote = true;
  try {
    await fn();
  } finally {
    // 延迟重置标志，确保所有同步操作完成
    // 使用 2000ms 延迟以确保 Realtime 事件有足够时间到达
    setTimeout(() => {      isApplyingRemote = false;
    }, 2000);
  }
}

/**
 * 检查当前是否在应用远程变更
 */
export function isApplyingRemoteChange(): boolean {
  return isApplyingRemote;
}

/**
 * 手动触发重连
 */
export async function reconnect(callbacks: RealtimeCallbacks): Promise<void> {
  console.log('[Realtime] 手动重连');
  await cleanupRealtimeSync();
  await initRealtimeSync(callbacks);
}

