import { logger } from '../utils/logger';
import { logger } from '../utils/logger';
import { logger } from '../utils/logger';
import { logger } from '../utils/logger';
// Supabase 客户端配置

import { createClient } from '@supabase/supabase-js';

// 默认配置（生产环境使用）
const DEFAULT_SUPABASE_URL = 'https://ptmgncjechjprxtndqon.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0bWduY2plY2hqcHJ4dG5kcW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzA2NjIsImV4cCI6MjA4MTcwNjY2Mn0.vN58E7gBVxZXfhL_qEUfYkX7ihMjMUr5z1_KQAul5Hg';

// 从环境变量、localStorage 或默认配置读取
// 优先级：环境变量 > localStorage > 默认配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 
  localStorage.getItem('SUPABASE_URL') || 
  DEFAULT_SUPABASE_URL;

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
  localStorage.getItem('SUPABASE_ANON_KEY') || 
  DEFAULT_SUPABASE_ANON_KEY;
// 创建 Supabase 客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 打印配置来源日志
if (import.meta.env.VITE_SUPABASE_URL) {
  logger.log('✅ 使用环境变量中的 Supabase 配置');
} else if (localStorage.getItem('SUPABASE_URL')) {
  logger.log('✅ 使用 localStorage 中的 Supabase 配置');
} else if (supabaseUrl === DEFAULT_SUPABASE_URL) {
  logger.log('✅ 使用默认 Supabase 配置（生产环境）');
}
/**
 * 获取当前用户 ID
 */
export async function getCurrentUserId(): Promise<string | null> {  
  const { data: { user } } = await supabase.auth.getUser();  
  return user?.id || null;
}

/**
 * 登录
 */
export async function signIn(email: string, password: string) {
  logger.log('🌐 调用 Supabase 登录 API');  
  try {
    const result = await supabase.auth.signInWithPassword({ email, password });    logger.log('📡 Supabase 登录响应:', result);
    return result;
  } catch (error) {    console.error('❌ signIn 异常:', error);
    throw error;
  }
}

/**
 * 注册
 */
export async function signUp(email: string, password: string) {
  return await supabase.auth.signUp({ email, password });
}

/**
 * 登出
 */
export async function signOut() {
  return await supabase.auth.signOut();
}




