import React, { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { getCurrentUserId, supabase } from '../lib/supabase';
import { getMedicationsFromCloud, getLogsFromCloud } from '../services/cloudOnly';
import { APP_VERSION } from '../config/version';

export const DebugPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [diagnostics, setDiagnostics] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const runDiagnostics = async () => {
      try {
        const userId = await getCurrentUserId();
        const meds = await getMedicationsFromCloud();
        const logs = await getLogsFromCloud();
        
        // 查询云端 required_version（容错处理）
        let requiredVersion = 'N/A';
        let versionCheckSkipped = false;
        
        // 【减少无意义 400】检查缓存标记，如果已禁用，不发起请求
        const versionCheckDisabledKey = 'version_check_disabled_column_missing';
        const isVersionCheckDisabled = localStorage.getItem(versionCheckDisabledKey) === 'true';
        
        if (isVersionCheckDisabled) {
          requiredVersion = '版本检查已禁用（列缺失/功能关闭）';
          versionCheckSkipped = true;
        } else if (userId && supabase) {
          try {
            const { data, error } = await supabase
              .from('app_state')
              .select('required_version')
              .eq('owner_id', userId)
              .maybeSingle();
            
            if (error) {
              // 【容错】如果列不存在（42703），标记为跳过
              if (error.code === '42703' || error.message?.includes('does not exist')) {
                requiredVersion = '版本检查已禁用（列缺失/功能关闭）';
                versionCheckSkipped = true;
                // 设置缓存标记，后续不再查询
                localStorage.setItem(versionCheckDisabledKey, 'true');
              } else {
                requiredVersion = `查询失败: ${error.code}`;
              }
            } else {
              requiredVersion = data?.required_version || 'null';
              // 如果查询成功，清除禁用标记（可能数据库已迁移）
              if (localStorage.getItem(versionCheckDisabledKey) === 'true') {
                localStorage.removeItem(versionCheckDisabledKey);
              }
            }
          } catch (err: any) {
            requiredVersion = `异常: ${err.message}`;
          }
        }

        const htmlVersion = (window as any).APP_VERSION || 'N/A';
        const versionMismatch = htmlVersion !== APP_VERSION;

        // 版本不一致时在控制台报错
        if (versionMismatch) {
          console.error('🚨 版本不一致检测:', {
            htmlVersion,
            tsVersion: APP_VERSION,
            mismatch: true,
            solution: '需要重新构建项目: npm run build'
          });
        }

        setDiagnostics({
          userId: userId || 'null',
          hasSupabase: !!supabase,
          networkOnline: navigator.onLine,
          appVersion: APP_VERSION,
          htmlVersion: htmlVersion,
          versionMismatch: versionMismatch,
          swVersion: 'checking...',
          requiredVersion: requiredVersion,
          versionCheckSkipped: versionCheckSkipped,
          medicationsCount: meds.length,
          logsCount: logs.length,
          localStorage: {
            isLoggedIn: localStorage.getItem('isLoggedIn'),
            deviceId: localStorage.getItem('device_id'),
            pwaForceUpdate: localStorage.getItem(`pwa_force_update_${APP_VERSION}`)
          },
          sessionStorage: {
            swHardReset: sessionStorage.getItem('sw_hard_reset_done'),
            pwaInFlight: sessionStorage.getItem('pwa_force_update_in_flight')
          }
        });

        // 查询 SW 版本
        if (navigator.serviceWorker.controller) {
          const channel = new MessageChannel();
          channel.port1.onmessage = (event) => {
            setDiagnostics((prev: any) => ({
              ...prev,
              swVersion: event.data?.version || 'unknown'
            }));
          };
          navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
        }

      } catch (error: any) {
        setDiagnostics({ error: error.message });
      } finally {
        setLoading(false);
      }
    };

    runDiagnostics();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-orange-500" />
            <h2 className="text-xl font-black italic">诊断面板</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <p className="text-center text-gray-500">加载中...</p>
          ) : (
            <>
              <DiagnosticItem label="用户 ID" value={diagnostics.userId} />
              <DiagnosticItem label="Supabase 配置" value={diagnostics.hasSupabase ? '✅ 已配置' : '❌ 未配置'} />
              <DiagnosticItem label="网络状态" value={diagnostics.networkOnline ? '✅ 在线' : '❌ 离线'} />
              
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h3 className="font-bold text-sm text-gray-500 mb-2">版本信息</h3>
                <DiagnosticItem label="TypeScript 版本" value={diagnostics.appVersion} />
                <DiagnosticItem label="HTML 版本" value={diagnostics.htmlVersion} />
                <DiagnosticItem label="SW 版本" value={diagnostics.swVersion} />
                <DiagnosticItem label="云端要求版本" value={diagnostics.requiredVersion} />
                {diagnostics.versionCheckSkipped && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                    <p className="text-yellow-700 text-sm font-bold">ℹ️ 版本检查跳过：required_version 不存在</p>
                    <p className="text-yellow-600 text-xs mt-1">数据库未迁移，版本检查已禁用（可选增强）</p>
                  </div>
                )}
                {diagnostics.versionMismatch && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                    <p className="text-red-600 text-sm font-bold">🚨 严重错误：版本不一致！</p>
                    <p className="text-red-600 text-xs mt-1">HTML: {diagnostics.htmlVersion} ≠ TS: {diagnostics.appVersion}</p>
                    <p className="text-red-600 text-xs mt-1">解决方案：重新构建项目 (npm run build)</p>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4 mt-4">
                <h3 className="font-bold text-sm text-gray-500 mb-2">数据统计</h3>
                <DiagnosticItem label="云端药品数" value={diagnostics.medicationsCount} />
                <DiagnosticItem label="云端记录数" value={diagnostics.logsCount} />
              </div>

              <div className="border-t border-gray-200 pt-4 mt-4">
                <h3 className="font-bold text-sm text-gray-500 mb-2">本地存储</h3>
                <DiagnosticItem label="登录状态" value={diagnostics.localStorage?.isLoggedIn || 'null'} />
                <DiagnosticItem label="设备 ID" value={diagnostics.localStorage?.deviceId?.substring(0, 20) + '...' || 'null'} />
                <DiagnosticItem label="PWA 强制更新" value={diagnostics.localStorage?.pwaForceUpdate || 'null'} />
                <DiagnosticItem label="SW 硬重置" value={diagnostics.sessionStorage?.swHardReset || 'null'} />
              </div>

              {diagnostics.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-600 text-sm font-bold">错误: {diagnostics.error}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const DiagnosticItem: React.FC<{ label: string; value: any }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-2 border-b border-gray-100">
    <span className="text-sm font-bold text-gray-600">{label}</span>
    <span className="text-sm font-mono bg-gray-100 px-3 py-1 rounded">
      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
    </span>
  </div>
);

