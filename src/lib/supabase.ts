// Supabase 客户端配置

import { createClient } from '@supabase/supabase-js';

// 从环境变量读取配置（如果没有则使用 Mock 模式）
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// 是否启用 Mock 模式
export const isMockMode = !supabaseUrl || !supabaseAnonKey;

export const supabase = isMockMode 
  ? null 
  : createClient(supabaseUrl, supabaseAnonKey);

/**
 * 获取当前用户 ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  if (isMockMode) {
    // Mock 模式：返回本地存储的用户 ID
    let userId = localStorage.getItem('mock_user_id');
    if (!userId) {
      userId = `mock_user_${Date.now()}`;
      localStorage.setItem('mock_user_id', userId);
    }
    return userId;
  }
  
  const { data: { user } } = await supabase!.auth.getUser();
  return user?.id || null;
}

/**
 * 登录（简化版，实际应该使用 Supabase Auth UI）
 */
export async function signIn(email: string, password: string) {
  if (isMockMode) {
    return { user: { id: await getCurrentUserId() }, error: null };
  }
  
  return await supabase!.auth.signInWithPassword({ email, password });
}

/**
 * 注册
 */
export async function signUp(email: string, password: string) {
  if (isMockMode) {
    return { user: { id: await getCurrentUserId() }, error: null };
  }
  
  return await supabase!.auth.signUp({ email, password });
}

/**
 * 登出
 */
export async function signOut() {
  if (isMockMode) {
    localStorage.removeItem('mock_user_id');
    return { error: null };
  }
  
  return await supabase!.auth.signOut();
}




