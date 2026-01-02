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
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'realtime.ts:27',message:'initRealtimeSync called',data:{hasCallbacks:!!callbacks},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    const userId = await getCurrentUserId();
    
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'realtime.ts:32',message:'getCurrentUserId result',data:{userId:userId,isNull:userId===null},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (!userId) {
      console.warn('[Realtime] 未登录，跳过 Realtime 初始化');
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'realtime.ts:38',message:'No userId - returning early',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return () => {};
    }
    
    const deviceId = getDeviceId();
    console.log('[Realtime] 初始化同步服务', { userId, deviceId });
    
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'realtime.ts:47',message:'Before supabase check',data:{supabaseExists:!!supabase,deviceId:deviceId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    
    // 如果已有连接，先清理
    if (realtimeChannel) {
      await cleanupRealtimeSync();
    }
    
    // 更新连接状态
    updateConnectionStatus('connecting', callbacks);
    
    // #endregion
    
    // 创建唯一频道
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'realtime.ts:56',message:'Creating channel',data:{channelName:`meds_sync_${deviceId}`},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
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
        if (!isApplyingRemote && callbacks.onMedicationChange) {
          callbacks.onMedicationChange();
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
        if (!isApplyingRemote && callbacks.onSettingsChange) {
          callbacks.onSettingsChange();
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] 订阅状态:', status);
        
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'realtime.ts:107',message:'Subscribe callback fired',data:{status:status},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C,D'})}).catch(()=>{});
        // #endregion
        
        if (status === 'SUBSCRIBED') {
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'realtime.ts:113',message:'Calling updateConnectionStatus with connected',data:{hasCallback:!!callbacks.onConnectionStatusChange},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          updateConnectionStatus('connected', callbacks);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'realtime.ts:119',message:'Error status received',data:{status:status},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
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
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'realtime.ts:152',message:'updateConnectionStatus called',data:{status:status,hasCallback:!!callbacks.onConnectionStatusChange},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D,E'})}).catch(()=>{});
  // #endregion
  
  connectionStatus = status;
  if (callbacks.onConnectionStatusChange) {
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'realtime.ts:159',message:'Calling onConnectionStatusChange callback',data:{status:status},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
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
  isApplyingRemote = true;
  try {
    await fn();
  } finally {
    // 延迟重置标志，确保所有同步操作完成
    setTimeout(() => {
      isApplyingRemote = false;
    }, 100);
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

