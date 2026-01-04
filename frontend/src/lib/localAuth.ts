/**
 * 本地测试认证（开发环境）
 * 绕过 Supabase，使用 localStorage 模拟登录
 */

const LOCAL_TEST_MODE = import.meta.env.VITE_LOCAL_TEST_MODE === 'true';
const TEST_USER_ID = 'local-test-user-12345';

/**
 * 检查是否启用本地测试模式
 */
export function isLocalTestMode(): boolean {
  return LOCAL_TEST_MODE;
}

/**
 * 本地登录
 */
export function localSignIn(email: string, password: string): Promise<{ user: { id: string; email: string } }> {
  return new Promise((resolve, reject) => {
    // 模拟网络延迟
    setTimeout(() => {
      // 接受任何邮箱和密码（仅用于测试）
      if (email && password.length >= 6) {
        localStorage.setItem('local_test_user', JSON.stringify({
          id: TEST_USER_ID,
          email: email,
          loggedIn: true
        }));
        resolve({
          user: {
            id: TEST_USER_ID,
            email: email
          }
        });
      } else {
        reject(new Error('邮箱和密码不能为空，密码至少6位'));
      }
    }, 300);
  });
}

/**
 * 本地注册
 */
export function localSignUp(email: string, password: string): Promise<{ user: { id: string; email: string } }> {
  return localSignIn(email, password);
}

/**
 * 获取本地测试用户
 */
export function getLocalTestUser(): { id: string; email: string } | null {
  const userStr = localStorage.getItem('local_test_user');
  if (userStr) {
    const user = JSON.parse(userStr);
    if (user.loggedIn) {
      return {
        id: user.id,
        email: user.email
      };
    }
  }
  return null;
}

/**
 * 本地登出
 */
export function localSignOut(): void {
  localStorage.removeItem('local_test_user');
  localStorage.removeItem('isLoggedIn');
}

/**
 * 检查本地登录状态
 */
export function isLocalLoggedIn(): boolean {
  const user = getLocalTestUser();
  return user !== null;
}

