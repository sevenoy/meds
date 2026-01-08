import { logger } from '../utils/logger';
import { logger } from '../utils/logger';
import { logger } from '../utils/logger';
import { logger } from '../utils/logger';
/**
 * 版本更新提示组件
 */
import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { forcePwaUpdateOncePerVersion } from '../sw-register';

interface UpdateLog {
  [version: string]: {
    title: string;
    date: string;
    content: string[];
  };
}

export const UpdateNotification: React.FC = () => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    title: string;
    content: string[];
  } | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // 获取当前版本号
    const currentVersion = (window as any).APP_VERSION || 'V251219.1';
    
    // 【修复升级提示】检查是否已经显示过这个版本的提示
    // 如果版本号变化，清除旧的标记，确保新版本提示能显示
    const lastShownVersion = localStorage.getItem('update_notification_shown');
    if (lastShownVersion && lastShownVersion !== currentVersion) {
      // 版本已升级，清除旧标记
      localStorage.removeItem('update_notification_shown');
      logger.log('🔄 检测到版本升级，清除旧版本标记', { lastShownVersion, currentVersion });
    }
    if (lastShownVersion === currentVersion) {
      return;
    }

    // 监听 Service Worker 更新事件
    const handleUpdateAvailable = async (event: any) => {
      logger.log('🎉 收到更新通知', event.detail);
      
      setRegistration(event.detail.registration);
      
      // 获取更新日志（不修改 URL）
      try {
        const response = await fetch('/update-log.json', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        const updateLog: UpdateLog = await response.json();
        
        // 获取最新版本的更新信息
        const versions = Object.keys(updateLog).sort().reverse();
        const latestVersion = versions[0];
        
        if (latestVersion && latestVersion !== lastShownVersion) {
          const info = updateLog[latestVersion];
          setUpdateInfo({
            title: info.title || '发现新版本',
            content: info.content || ['本次更新包含了一些改进和修复']
          });
          setShowUpdate(true);
        }
      } catch (error) {
        console.error('获取更新日志失败:', error);
        // 使用默认信息
        setUpdateInfo({
          title: '发现新版本',
          content: ['应用已更新，点击刷新查看最新版本']
        });
        setShowUpdate(true);
      }
    };

    window.addEventListener('sw-update-available', handleUpdateAvailable);

    // 定期检查更新（每分钟）
    const checkInterval = setInterval(async () => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          logger.log('🔍 检查应用更新...');
          registration.update();
        }
      }
    }, 60000);

    return () => {
      window.removeEventListener('sw-update-available', handleUpdateAvailable);
      clearInterval(checkInterval);
    };
  }, []);

  const handleUpdate = async () => {
    const currentVersion = (window as any).APP_VERSION || 'V251219.1';
    
    // 记录已显示
    localStorage.setItem('update_notification_shown', currentVersion);
    
    // 【修复清缓存策略】使用 forcePwaUpdateOncePerVersion('manual') 统一处理
    // 这会触发 CLEAR_CACHE 和 SKIP_WAITING，但只在用户主动操作时
    try {
      await forcePwaUpdateOncePerVersion('manual');
    } catch (error) {
      console.error('❌ 更新失败:', error);
      // 如果 forcePwaUpdateOncePerVersion 失败，直接刷新
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    const currentVersion = (window as any).APP_VERSION || 'V251219.1';
    localStorage.setItem('update_notification_shown', currentVersion);
    setShowUpdate(false);
  };

  if (!showUpdate || !updateInfo) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* 头部 */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 relative">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">
                {updateInfo.title}
              </h2>
              <p className="text-sm text-white/80">
                发现新版本可用
              </p>
            </div>
          </div>
        </div>

        {/* 更新内容 */}
        <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
          <div className="space-y-2">
            {updateInfo.content.map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-2 text-sm text-gray-700"
              >
                <span className="text-blue-600 flex-shrink-0 mt-0.5">•</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={handleDismiss}
            className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
          >
            稍后更新
          </button>
          <button
            onClick={handleUpdate}
            className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            立即更新
          </button>
        </div>
      </div>
    </div>
  );
};

