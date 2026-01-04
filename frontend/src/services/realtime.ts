import { supabase, getCurrentUserId, getDeviceId } from '../lib/supabase';
import type { Medication, MedicationLog, UserSettings } from '../../shared/types';

export interface RealtimeCallbacks {
  onMedicationChange?: () => void;
  onLogChange?: (log: MedicationLog) => void;
  onSettingsChange?: (settings: UserSettings) => void;
}

let isApplyingRemote = false;

/**
 * 检查是否正在应用远程变更
 */
export function isApplyingRemoteChange(): boolean {
  return isApplyingRemote;
}

/**
 * 使用远程标志执行函数
 */
export async function runWithRemoteFlag(fn: () => Promise<void>): Promise<void> {
  isApplyingRemote = true;
  try {
    await fn();
  } finally {
    // 延迟重置标志，确保所有同步操作完成
    setTimeout(() => {
      isApplyingRemote = false;
    }, 2000);
  }
}

/**
 * 初始化实时同步
 */
export async function initRealtimeSync(
  callbacks: RealtimeCallbacks
): Promise<() => void> {
  const userId = await getCurrentUserId();
  const deviceId = getDeviceId();

  if (!userId) {
    console.warn('[Realtime] 用户未登录，无法初始化实时同步');
    return () => {};
  }

  const channel = supabase
    .channel(`meds_sync_${deviceId}`)
    // 订阅 medications 表
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'medications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        const newData = payload.new as Medication;
        const currentDeviceId = getDeviceId();

        // 检查是否是自己设备的更新
        if (newData.device_id === currentDeviceId) {
          console.log('[Realtime] 忽略自己设备的更新');
          return;
        }

        // 检查是否正在应用远程变更
        if (isApplyingRemote) {
          console.log('[Realtime] 正在应用远程变更，忽略此事件');
          return;
        }

        console.log('[Realtime] 收到药品更新:', newData);
        callbacks.onMedicationChange?.();
      }
    )
    // 订阅 medication_logs 表
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'medication_logs',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        const log = payload.new as MedicationLog;
        const currentDeviceId = getDeviceId();

        if (log.source_device === currentDeviceId) {
          console.log('[Realtime] 忽略自己设备的记录更新');
          return;
        }

        if (isApplyingRemote) {
          return;
        }

        console.log('[Realtime] 收到记录更新:', log);
        callbacks.onLogChange?.(log);
      }
    )
    // 订阅 user_settings 表
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_settings',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        const settings = payload.new as UserSettings;
        console.log('[Realtime] 收到设置更新:', settings);
        callbacks.onSettingsChange?.(settings);
      }
    )
    .subscribe((status) => {
      console.log('[Realtime] 订阅状态:', status);
    });

  // 返回取消订阅函数
  return () => {
    supabase.removeChannel(channel);
  };
}

