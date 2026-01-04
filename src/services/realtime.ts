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
        console.log('[Realtime] 药品变更', payload);
        
        // 检查是否是自己设备的更新
        const newData = payload.new as any;
        console.log('[Realtime] 检查 device_id:', {
          payloadDeviceId: newData?.device_id,
          currentDeviceId: deviceId,
          isMatch: newData?.device_id === deviceId
        });
        
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'realtime.ts:onUpdate',message:'Received UPDATE event',data:{payloadDeviceId:newData?.device_id,currentDeviceId:deviceId,isApplyingRemote:isApplyingRemote,medicationId:newData?.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,C,D'})}).catch(()=>{});
        // #endregion
        
        if (newData && newData.device_id === deviceId) {
          console.log('[Realtime] 忽略自己设备的药品更新');
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'realtime.ts:onUpdate:ignored',message:'Ignored own device update',data:{medicationId:newData?.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          return;
        }
        
        if (!isApplyingRemote && callbacks.onMedicationChange) {
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'realtime.ts:onUpdate:callback',message:'Calling onMedicationChange callback',data:{medicationId:newData?.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C,E'})}).catch(()=>{});
          // #endregion
          callbacks.onMedicationChange();
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'realtime.ts:onUpdate:skipped',message:'Skipped callback',data:{isApplyingRemote:isApplyingRemote,hasCallback:!!callbacks.onMedicationChange},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,C'})}).catch(()=>{});
          // #endregion
        }
      })
      // 订阅服药记录表变更
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'medication_logs',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        console.log('[Realtime] 服药记录变更', payload);
        
        // 检查是否是自己设备的更新
        const newData = payload.new as any;
        if (newData && newData.device_id === deviceId) {
          console.log('[Realtime] 忽略自己设备的记录更新');
          return;
        }
        
        if (!isApplyingRemote && callbacks.onLogChange) {
          callbacks.onLogChange();
        }
      })
      // 订阅用户设置表变更
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_settings',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        console.log('[Realtime] 用户设置变更', payload);
        
        // 检查是否是自己设备的更新
        const newData = payload.new as any;
        if (newData && newData.device_id === deviceId) {
          console.log('[Realtime] 忽略自己设备的设置更新');
          return;
        }
        
        if (!isApplyingRemote && callbacks.onSettingsChange) {
          callbacks.onSettingsChange();
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] 订阅状态:', status);
        
        if (status === 'SUBSCRIBED') {
          updateConnectionStatus('connected', callbacks);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          updateConnectionStatus('disconnected', callbacks);
          // 自动重连
          setTimeout(() => {
            console.log('[Realtime] 尝试重新连接...');
            initRealtimeSync(callbacks);
          }, 5000);
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
export async function runWithRemoteFlag(fn: () => Promise<void>): Promise<void> {
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'realtime.ts:runWithRemoteFlag:entry',message:'Setting isApplyingRemote=true',data:{wasApplyingRemote:isApplyingRemote},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,C'})}).catch(()=>{});
  // #endregion
  isApplyingRemote = true;
  try {
    await fn();
  } finally {
    // 延迟重置标志，确保所有同步操作完成
    // 使用 2000ms 延迟以确保 Realtime 事件有足够时间到达
    setTimeout(() => {
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'realtime.ts:runWithRemoteFlag:reset',message:'Resetting isApplyingRemote=false after 2000ms',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      isApplyingRemote = false;
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

