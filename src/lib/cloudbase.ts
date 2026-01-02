/**
 * 腾讯云 CloudBase 配置
 */

import cloudbase from '@cloudbase/js-sdk';

// CloudBase 配置
// 请在腾讯云控制台获取这些配置信息
const CLOUDBASE_ENV_ID = import.meta.env.VITE_CLOUDBASE_ENV_ID || 
  localStorage.getItem('CLOUDBASE_ENV_ID') || 
  ''; // 请填入你的环境 ID

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

// 获取存储实例
export const storage = app.uploadFile.bind(app);

/**
 * 获取当前用户 ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const loginState = await auth.getLoginState();
    return loginState?.user?.uid || null;
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
    // CloudBase 使用用户名密码登录
    const result = await auth.signInWithUsernameAndPassword(username, password);
    return { data: result, error: null };
  } catch (error: any) {
    console.error('登录失败:', error);
    return { data: null, error: { message: error.message || '登录失败' } };
  }
}

/**
 * 注册新用户
 */
export async function signUp(username: string, password: string) {
  try {
    const result = await auth.signUpWithUsernameAndPassword(username, password);
    return { data: result, error: null };
  } catch (error: any) {
    console.error('注册失败:', error);
    return { data: null, error: { message: error.message || '注册失败' } };
  }
}

/**
 * 登出
 */
export async function signOut() {
  try {
    await auth.signOut();
    return { error: null };
  } catch (error: any) {
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

// 导出 CloudBase 实例
export default app;

