// 登录页面组件

import React, { useState } from 'react';
import { User, Lock, LogIn, AlertCircle } from 'lucide-react';
import { signIn } from '../lib/supabase';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 将用户名转换为邮箱格式
      const email = `${username}@gmail.com`;
      console.log('🔐 尝试登录:', email);
      
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LoginPage.tsx:34',message:'Before signIn call',data:{email:email},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'I'})}).catch(()=>{});
      // #endregion
      
      // 调用 Supabase 登录
      const { data, error: loginError } = await signIn(email, password);
      
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LoginPage.tsx:42',message:'After signIn call',data:{hasData:!!data,hasError:!!loginError,errorMsg:loginError?.message},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'I'})}).catch(()=>{});
      // #endregion
      
      console.log('📋 登录结果:', { data, error: loginError });
      
      if (loginError) {
        console.error('❌ 登录失败:', loginError);
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LoginPage.tsx:51',message:'Login error details',data:{message:loginError.message,status:loginError.status,name:loginError.name},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'G,H,I'})}).catch(()=>{});
        // #endregion
        setError(`登录失败：${loginError.message || '用户名或密码错误'}`);
        setLoading(false);
        return;
      }

      // 登录成功
      console.log('✅ 登录成功');
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LoginPage.tsx:62',message:'Login success',data:{userId:data?.user?.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'I'})}).catch(()=>{});
      // #endregion
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('username', username);
      setLoading(false);
      onLoginSuccess();
    } catch (err) {
      console.error('❌ 登录异常:', err);
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LoginPage.tsx:72',message:'Login exception caught',data:{error:err instanceof Error ? err.message : String(err),errorType:err instanceof Error ? err.constructor.name : typeof err},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H,I'})}).catch(()=>{});
      // #endregion
      const errorMessage = err instanceof Error ? err.message : '请重试';
      setError(`登录失败：${errorMessage}`);

      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      {/* 背景装饰 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 -left-20 text-[20rem] font-black text-blue-600 opacity-[0.03] uppercase italic tracking-tighter">
          药盒
        </div>
        <div className="absolute bottom-20 -right-20 text-[20rem] font-black text-purple-600 opacity-[0.03] uppercase italic tracking-tighter">
          助手
        </div>
      </div>

      {/* 登录卡片 */}
      <div className="relative z-10 bg-white rounded-[40px] p-8 md:p-12 max-w-md w-full shadow-2xl border border-gray-100">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <User className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter mb-2">
            药盒助手
          </h1>
          <p className="text-sm text-gray-500 font-bold tracking-wide">
            智能服药追踪系统
          </p>
        </div>

        {/* 登录表单 */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* 用户名 */}
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2">
              用户名
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none font-medium transition-all"
                disabled={loading}
              />
            </div>
          </div>

          {/* 密码 */}
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2">
              密码
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none font-medium transition-all"
                disabled={loading}
              />
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-xs font-bold">{error}</p>
            </div>
          )}

          {/* 登录按钮 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-black italic rounded-full tracking-tighter hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? (
              <>正在登录...</>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                登录
              </>
            )}
          </button>
        </form>

        {/* 提示信息 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400 font-medium">
            © 2025 药盒助手 · 智能服药追踪
          </p>
        </div>
      </div>
    </div>
  );
};
