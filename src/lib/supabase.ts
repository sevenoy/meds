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

// 是否启用 Mock 模式
export const isMockMode = !supabaseUrl || !supabaseAnonKey;

// 创建 Supabase 客户端
export const supabase = isMockMode 
  ? null 
  : createClient(supabaseUrl, supabaseAnonKey);

// 打印配置来源日志
if (import.meta.env.VITE_SUPABASE_URL) {
  console.log('✅ 使用环境变量中的 Supabase 配置');
} else if (localStorage.getItem('SUPABASE_URL')) {
  console.log('✅ 使用 localStorage 中的 Supabase 配置');
} else if (supabaseUrl === DEFAULT_SUPABASE_URL) {
  console.log('✅ 使用默认 Supabase 配置（生产环境）');
}

/**
 * 获取当前用户 ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase.ts:40',message:'getCurrentUserId called',data:{isMockMode:isMockMode,supabaseIsNull:supabase===null},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B'})}).catch(()=>{});
  // #endregion
  
  if (isMockMode) {
    // Mock 模式：返回本地存储的用户 ID
    let userId = localStorage.getItem('mock_user_id');
    if (!userId) {
      userId = `mock_user_${Date.now()}`;
      localStorage.setItem('mock_user_id', userId);
    }
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase.ts:52',message:'Mock mode - returning userId',data:{userId:userId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
    return userId;
  }
  
  const { data: { user } } = await supabase!.auth.getUser();
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase.ts:59',message:'Supabase mode - got user',data:{userId:user?.id||null},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
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




