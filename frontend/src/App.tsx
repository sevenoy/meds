import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import MainApp from './components/MainApp';
import { getCurrentUserId } from './lib/supabase';
import './App.css';

function App() {
  // 本地测试模式：跳过登录，直接显示主页面
  // 强制启用跳过登录（用于测试）
  const SKIP_LOGIN = true; // 临时强制启用
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(SKIP_LOGIN ? true : null);
  const [loading, setLoading] = useState(!SKIP_LOGIN);

  useEffect(() => {
    if (SKIP_LOGIN) {
      // 本地测试模式：模拟登录状态
      console.log('[App] 跳过登录检查，直接进入主页面');
      setIsAuthenticated(true);
      setLoading(false);
      return;
    }
    checkAuth();
  }, [SKIP_LOGIN]);

  const checkAuth = async () => {
    try {
      const userId = await getCurrentUserId();
      setIsAuthenticated(!!userId);
    } catch (error) {
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            SKIP_LOGIN ? (
              <Navigate to="/" replace />
            ) : isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage onLogin={checkAuth} />
            )
          }
        />
        <Route
          path="/*"
          element={
            SKIP_LOGIN || isAuthenticated ? (
              <MainApp onLogout={checkAuth} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;

