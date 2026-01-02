/**
 * 腾讯云 CloudBase 配置（Web 版本）
 */

import cloudbase from '@cloudbase/js-sdk';

// CloudBase 环境 ID
const CLOUDBASE_ENV_ID = import.meta.env.VITE_CLOUDBASE_ENV_ID || 
  localStorage.getItem('CLOUDBASE_ENV_ID') || 
  'cloud1-8gi1awiz3bd99542'; // 你的环境 ID

console.log('🌐 CloudBase 环境 ID:', CLOUDBASE_ENV_ID);

// 初始化 CloudBase
const app = cloudbase.init({
  env: CLOUDBASE_ENV_ID,
});

// 获取认证实例
export const auth = app.auth({
  persistence: 'local', // 持久化到本地
});

// 获取数据库实例
export const db = app.database();

// 数据库集合
export const collections = {
  medications: db.collection('medications'),
  medication_logs: db.collection('medication_logs'),
  user_settings: db.collection('user_settings'),
};

/**
 * 获取当前用户信息
 */
export async function getCurrentUser() {
  try {
    const loginState = await auth.getLoginState();
    return loginState?.user || null;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
}

/**
 * 获取当前用户 ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    return user?.uid || null;
  } catch (error) {
    console.error('获取用户 ID 失败:', error);
    return null;
  }
}

/**
 * 用户名密码登录
 */
export async function signIn(username: string, password: string) {
  try {
    console.log('🔐 CloudBase 登录:', username);
    
    // CloudBase Web SDK 使用 signInWithUsernameAndPassword
    const result = await auth.signInWithUsernameAndPassword(username, password);
    
    console.log('✅ CloudBase 登录成功:', result);
    return { data: result, error: null };
  } catch (error: any) {
    console.error('❌ CloudBase 登录失败:', error);
    return { 
      data: null, 
      error: { 
        message: error.message || error.code || '登录失败',
        code: error.code 
      } 
    };
  }
}

/**
 * 注册新用户
 */
export async function signUp(username: string, password: string) {
  try {
    console.log('📝 CloudBase 注册:', username);
    
    const result = await auth.signUpWithUsernameAndPassword(username, password);
    
    console.log('✅ CloudBase 注册成功:', result);
    return { data: result, error: null };
  } catch (error: any) {
    console.error('❌ CloudBase 注册失败:', error);
    return { 
      data: null, 
      error: { 
        message: error.message || error.code || '注册失败',
        code: error.code 
      } 
    };
  }
}

/**
 * 登出
 */
export async function signOut() {
  try {
    await auth.signOut();
    console.log('✅ CloudBase 登出成功');
    return { error: null };
  } catch (error: any) {
    console.error('❌ CloudBase 登出失败:', error);
    return { error: { message: error.message || '登出失败' } };
  }
}

/**
 * 检查是否已登录
 */
export async function checkLoginState() {
  try {
    const loginState = await auth.getLoginState();
    return !!loginState;
  } catch (error) {
    return false;
  }
}

/**
 * 辅助函数：获取当前时间 ISO 字符串
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * 辅助函数：要求用户已登录
 */
export async function requireUserId(): Promise<string> {
  const uid = await getCurrentUserId();
  if (!uid) {
    throw new Error('未登录：缺少用户 ID');
  }
  return uid;
}

// 导出 CloudBase 实例
export default app;

