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
 * 保存用户设置
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

    // 保存到Supabase（upsert: 存在则更新，不存在则插入）
    const { error } = await supabase!
      .from('user_settings')
      .upsert({
        user_id: userId,
        settings: settings,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) throw error;

    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
    console.log('✅ 用户设置已同步到云端');
  } catch (error) {
    console.error('❌ 同步用户设置失败:', error);
    // 不抛出错误，确保本地保存成功
  }
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
