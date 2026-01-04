import { createClient } from '@supabase/supabase-js';
import type { Medication, MedicationLog, UserSettings } from '../../shared/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase 配置缺失，请设置环境变量');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 获取当前用户 ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  // 检查本地测试模式
  if (import.meta.env.VITE_LOCAL_TEST_MODE === 'true') {
    const { getLocalTestUser } = await import('./localAuth');
    const user = getLocalTestUser();
    return user?.id || null;
  }
  
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * 获取当前会话
 */
export async function getSession() {
  // 检查本地测试模式
  if (import.meta.env.VITE_LOCAL_TEST_MODE === 'true') {
    const { getLocalTestUser } = await import('./localAuth');
    const user = getLocalTestUser();
    if (user) {
      return {
        user: {
          id: user.id,
          email: user.email
        }
      };
    }
    return null;
  }
  
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * 登录
 */
export async function signIn(email: string, password: string) {
  // 检查本地测试模式
  const isLocalTest = import.meta.env.VITE_LOCAL_TEST_MODE === 'true';
  console.log('[Auth] 本地测试模式:', isLocalTest);
  
  if (isLocalTest) {
    const { localSignIn } = await import('./localAuth');
    console.log('[Auth] 使用本地登录');
    return await localSignIn(email, password);
  }
  
  console.log('[Auth] 使用 Supabase 登录');
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) throw error;
  return data;
}

/**
 * 注册
 */
export async function signUp(email: string, password: string) {
  // 检查本地测试模式
  const isLocalTest = import.meta.env.VITE_LOCAL_TEST_MODE === 'true';
  console.log('[Auth] 本地测试模式:', isLocalTest);
  
  if (isLocalTest) {
    const { localSignUp } = await import('./localAuth');
    console.log('[Auth] 使用本地注册');
    return await localSignUp(email, password);
  }
  
  console.log('[Auth] 使用 Supabase 注册');
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });
  
  if (error) throw error;
  return data;
}

/**
 * 登出
 */
export async function signOut() {
  // 检查本地测试模式
  if (import.meta.env.VITE_LOCAL_TEST_MODE === 'true') {
    const { localSignOut } = await import('./localAuth');
    localSignOut();
    return;
  }
  
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  localStorage.removeItem('isLoggedIn');
}

/**
 * 获取设备 ID
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem('device_id');
  
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('device_id', deviceId);
  }
  
  return deviceId;
}

