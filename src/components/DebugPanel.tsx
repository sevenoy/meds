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
        
        // 查询云端 required_version
        let requiredVersion = 'N/A';
        if (userId && supabase) {
          const { data } = await supabase
            .from('app_state')
            .select('required_version')
            .eq('owner_id', userId)
            .maybeSingle();
          requiredVersion = data?.required_version || 'null';
        }

        setDiagnostics({
          userId: userId || 'null',
          hasSupabase: !!supabase,
          networkOnline: navigator.onLine,
          appVersion: APP_VERSION,
          htmlVersion: (window as any).APP_VERSION || 'N/A',
          swVersion: 'checking...',
          requiredVersion: requiredVersion,
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
                {diagnostics.appVersion !== diagnostics.htmlVersion && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                    <p className="text-red-600 text-sm font-bold">⚠️ 版本不一致！需要重新构建</p>
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

