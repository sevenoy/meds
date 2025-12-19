// Supabase 客户端配置

import { createClient } from '@supabase/supabase-js';

// 从环境变量或 localStorage 读取配置
// 优先级：环境变量 > localStorage
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 
  localStorage.getItem('SUPABASE_URL') || 
  '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
  localStorage.getItem('SUPABASE_ANON_KEY') || 
  '';

// 是否启用 Mock 模式
export const isMockMode = !supabaseUrl || !supabaseAnonKey;

// 创建 Supabase 客户端
export const supabase = isMockMode 
  ? null 
  : createClient(supabaseUrl, supabaseAnonKey);

// 如果使用的是 localStorage 配置，打印日志
if (!import.meta.env.VITE_SUPABASE_URL && supabaseUrl) {
  console.log('✅ 使用 localStorage 中的 Supabase 配置');
}

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
    console.log('🔧 Mock模式：自动登录成功');
    return { data: { user: { id: await getCurrentUserId() } }, error: null };
  }
  
  console.log('🌐 Supabase模式：调用登录API');
  const result = await supabase!.auth.signInWithPassword({ email, password });
  console.log('📡 Supabase登录响应:', result);
  return result;
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




