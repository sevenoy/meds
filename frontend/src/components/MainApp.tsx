import { useState, useEffect } from 'react';
import { signOut } from '../lib/supabase';
import MedicationList from './MedicationList';
import TodayProgress from './TodayProgress';
import LogHistory from './LogHistory';
import SyncStatusIndicator from './SyncStatusIndicator';
import { LogOut } from 'lucide-react';

interface MainAppProps {
  onLogout: () => void;
}

export default function MainApp({ onLogout }: MainAppProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 初始化应用
    setLoading(false);
  }, []);

  const handleLogout = async () => {
    try {
      // 本地测试模式：直接清除状态
      if (import.meta.env.VITE_LOCAL_TEST_MODE === 'true' || import.meta.env.VITE_SKIP_LOGIN === 'true') {
        localStorage.removeItem('local_test_user');
        localStorage.removeItem('isLoggedIn');
        onLogout();
        return;
      }
      await signOut();
      onLogout();
    } catch (error) {
      console.error('登出失败:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-black italic tracking-tighter uppercase">
            药盒助手
          </h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>登出</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase leading-none text-black">
            TODAY
          </h2>
          <SyncStatusIndicator 
            status="synced" 
            lastSyncTime={new Date()}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <div className="md:col-span-1">
            <TodayProgress />
          </div>
          <div className="md:col-span-2">
            <LogHistory />
          </div>
        </div>
        
        <MedicationList />
      </main>
    </div>
  );
}

