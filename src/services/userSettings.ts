/**
 * 用户设置云端同步服务
 */

import { supabase, isMockMode, getCurrentUserId } from '../lib/supabase';

export interface UserSettings {
  theme?: 'light' | 'dark';
  notifications?: boolean;
  language?: string;
  calendar?: {
    showWeekends?: boolean;
    startOfWeek?: number;
  };
  [key: string]: any; // 允许其他自定义设置
}

const SETTINGS_KEY = 'user_settings';
const LAST_SYNC_KEY = 'settings_last_sync';

/**
 * 获取用户设置
 */
export async function getUserSettings(): Promise<UserSettings> {
  if (isMockMode) {
    // Mock模式：从localStorage读取
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? JSON.parse(stored) : {};
  }

  try {
    const userId = await getCurrentUserId();
    if (!userId) return {};

    // 从Supabase获取设置
    const { data, error } = await supabase!
      .from('user_settings')
      .select('settings')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 记录不存在，返回空设置
        return {};
      }
      throw error;
    }

    // 更新本地缓存
    if (data) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
      localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
    }

    return data?.settings || {};
  } catch (error) {
    console.error('❌ 获取用户设置失败:', error);
    // 降级到本地存储
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? JSON.parse(stored) : {};
  }
}

/**
 * 保存用户设置（带冲突检测 - LWW策略）
 */
export async function saveUserSettings(settings: UserSettings): Promise<void> {
  // 先保存到本地
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

  if (isMockMode) {
    console.log('🔧 Mock模式：设置已保存到本地');
    return;
  }

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn('⚠️ 未登录，无法同步设置到云端');
      return;
    }

    console.log('☁️ 同步用户设置到云端...');

    // Step 1: 获取云端最新数据（LWW冲突检测）
    const { data: cloudData } = await supabase!
      .from('user_settings')
      .select('settings, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    const lastSyncTimestamp = parseInt(localStorage.getItem(LAST_SYNC_KEY) || '0');
    
    // Step 2: 检测云端是否有更新
    if (cloudData) {
      const cloudTimestamp = new Date(cloudData.updated_at).getTime();
      
      // 比较数据内容（标准化比较）
      const cloudSettings = JSON.stringify(normalizeSettings(cloudData.settings));
      const localSettings = JSON.stringify(normalizeSettings(settings));
      
      // 如果内容相同，只更新时间戳
      if (cloudSettings === localSettings) {
        if (cloudTimestamp > lastSyncTimestamp) {
          console.log('📊 设置内容相同，更新本地时间戳');
          localStorage.setItem(LAST_SYNC_KEY, cloudTimestamp.toString());
        } else {
          console.log('✅ 设置已同步，无需操作');
        }
        return;
      }
      
      // Step 3: 检测冲突（云端数据更新）
      if (cloudTimestamp > lastSyncTimestamp) {
        console.warn('⚠️ 检测到云端设置更新，本地修改被覆盖');
        // 应用云端设置（LWW策略）
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(cloudData.settings));
        localStorage.setItem(LAST_SYNC_KEY, cloudTimestamp.toString());
        
        // 触发全局事件通知应用刷新
        window.dispatchEvent(new CustomEvent('settings-conflict-resolved', {
          detail: { settings: cloudData.settings, source: 'cloud' }
        }));
        
        console.log('✅ 已应用云端最新设置（Last Write Wins）');
        return;
      }
    }

    // Step 4: 本地数据更新，保存到云端
    const newTimestamp = new Date().toISOString();
    console.log('📤 正在推送用户设置到云端...', { userId, settings });
    
    const { error, data } = await supabase!
      .from('user_settings')
      .upsert({
        user_id: userId,
        settings: settings,
        updated_at: newTimestamp
      }, {
        onConflict: 'user_id'
      })
      .select();

    if (error) {
      console.error('❌ 推送失败:', error);
      throw error;
    }

    console.log('✅ 推送成功，云端数据已更新:', data);
    console.log('📡 Realtime将自动推送到其他设备...');

    // 更新本地时间戳
    localStorage.setItem(LAST_SYNC_KEY, new Date(newTimestamp).getTime().toString());
    console.log('✅ 用户设置已同步到云端（LWW策略）');
  } catch (error) {
    console.error('❌ 同步用户设置失败:', error);
    // 不抛出错误，确保本地保存成功
  }
}

/**
 * 标准化设置对象（用于比较）
 */
function normalizeSettings(settings: any): any {
  if (!settings) return {};
  
  // 深拷贝并排序键，确保比较一致性
  const normalized: any = {};
  Object.keys(settings).sort().forEach(key => {
    const value = settings[key];
    if (typeof value === 'object' && value !== null) {
      normalized[key] = normalizeSettings(value);
    } else {
      normalized[key] = value;
    }
  });
  
  return normalized;
}

/**
 * 更新部分设置
 */
export async function updateUserSettings(partialSettings: Partial<UserSettings>): Promise<void> {
  const currentSettings = await getUserSettings();
  const newSettings = { ...currentSettings, ...partialSettings };
  await saveUserSettings(newSettings);
}

/**
 * 初始化设置实时监听
 */
export function initSettingsRealtimeSync(onSettingsUpdate: (settings: UserSettings) => void): () => void {
  if (isMockMode) {
    console.log('🔧 Mock模式：跳过设置实时同步');
    return () => {};
  }

  getCurrentUserId().then(userId => {
    if (!userId) return;

    console.log('🔄 启动用户设置实时监听...');

    const channel = supabase!
      .channel('user-settings-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_settings',
          filter: `user_id=eq.${userId}`
        },
        async (payload) => {
          console.log('📥 收到用户设置更新:', payload);
          
          if (payload.new && typeof payload.new === 'object' && 'settings' in payload.new) {
            const newSettings = (payload.new as any).settings;
            
            // 检查是否来自其他设备
            const lastSync = parseInt(localStorage.getItem(LAST_SYNC_KEY) || '0');
            const updateTime = new Date((payload.new as any).updated_at).getTime();
            
            if (updateTime > lastSync) {
              console.log('🔔 其他设备更新了设置，自动应用...');
              localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
              localStorage.setItem(LAST_SYNC_KEY, updateTime.toString());
              onSettingsUpdate(newSettings);
              console.log('✅ 设置已自动更新');
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('🔄 设置同步状态:', status);
      });

    // 返回清理函数
    return () => {
      console.log('🔌 断开设置同步');
      supabase!.removeChannel(channel);
    };
  }).catch(err => {
    console.error('❌ 启动设置同步失败:', err);
  });

  return () => {};
}

/**
 * 清除本地设置缓存
 */
export function clearLocalSettings(): void {
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(LAST_SYNC_KEY);
}
