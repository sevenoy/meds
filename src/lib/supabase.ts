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

// #region agent log
fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase.ts:23',message:'Supabase config',data:{url:supabaseUrl,hasKey:!!supabaseAnonKey,keyLength:supabaseAnonKey?.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
// #endregion

// 创建 Supabase 客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 打印配置来源日志
if (import.meta.env.VITE_SUPABASE_URL) {
  console.log('✅ 使用环境变量中的 Supabase 配置');
} else if (localStorage.getItem('SUPABASE_URL')) {
  console.log('✅ 使用 localStorage 中的 Supabase 配置');
} else if (supabaseUrl === DEFAULT_SUPABASE_URL) {
  console.log('✅ 使用默认 Supabase 配置（生产环境）');
}

// #region agent log
fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase.ts:35',message:'Supabase client created',data:{clientExists:!!supabase},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
// #endregion

/**
 * 获取当前用户 ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase.ts:42',message:'getCurrentUserId 调用',data:{supabaseExists:!!supabase,localStorageLogin:localStorage.getItem('isLoggedIn')},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  const { data: { user } } = await supabase.auth.getUser();
  
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase.ts:48',message:'getUser 返回结果',data:{userId:user?.id||null,hasUser:!!user,email:user?.email||null},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  return user?.id || null;
}

/**
 * 登录
 */
export async function signIn(email: string, password: string) {
  console.log('🌐 调用 Supabase 登录 API');
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase.ts:55',message:'signIn called',data:{email:email,hasPassword:!!password},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'G,H,I'})}).catch(()=>{});
  // #endregion
  
  try {
    const result = await supabase.auth.signInWithPassword({ email, password });
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase.ts:62',message:'signIn result',data:{hasData:!!result.data,hasError:!!result.error,errorMessage:result.error?.message,errorStatus:result.error?.status},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'G,H,I'})}).catch(()=>{});
    // #endregion
    console.log('📡 Supabase 登录响应:', result);
    return result;
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase.ts:69',message:'signIn exception',data:{error:error instanceof Error ? error.message : String(error),errorName:error instanceof Error ? error.name : 'unknown'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H,I'})}).catch(()=>{});
    // #endregion
    console.error('❌ signIn 异常:', error);
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




