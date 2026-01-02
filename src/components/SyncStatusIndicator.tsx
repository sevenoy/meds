/**
 * 同步状态指示器组件
 * 显示 Realtime 连接状态
 */

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface SyncStatusIndicatorProps {
  status: 'connected' | 'disconnected' | 'connecting';
  onReconnect?: () => void;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ 
  status, 
  onReconnect 
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: <Wifi className="w-4 h-4" />,
          text: '已连接',
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          borderColor: 'border-green-300'
        };
      case 'connecting':
        return {
          icon: <RefreshCw className="w-4 h-4 animate-spin" />,
          text: '连接中',
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          borderColor: 'border-blue-300'
        };
      case 'disconnected':
        return {
          icon: <WifiOff className="w-4 h-4" />,
          text: '未连接',
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          borderColor: 'border-red-300'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${config.bgColor} ${config.color} ${config.borderColor} border hover:opacity-80`}
      >
        {config.icon}
        <span>{config.text}</span>
      </button>

      {showDetails && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-200 p-4 z-50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-sm">同步状态</h4>
            <button
              onClick={() => setShowDetails(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">连接状态</span>
              <span className={`font-bold ${config.color}`}>{config.text}</span>
            </div>

            {status === 'connected' && (
              <div className="text-gray-600 text-xs mt-2">
                ✅ 多设备实时同步已启用
              </div>
            )}

            {status === 'disconnected' && (
              <div className="mt-3">
                <button
                  onClick={() => {
                    setShowDetails(false);
                    onReconnect?.();
                  }}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded-full font-bold hover:bg-blue-600 transition-all"
                >
                  重新连接
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};



