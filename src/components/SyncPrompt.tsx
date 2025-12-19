// 多设备同步提示组件

import React from 'react';
import { AlertCircle, Clock, Smartphone, Check, X } from 'lucide-react';
import type { MedicationLog } from '../types';

interface SyncPromptProps {
  log: MedicationLog;
  onAccept: () => void;
  onDismiss: () => void;
}

export const SyncPrompt: React.FC<SyncPromptProps> = ({ log, onAccept, onDismiss }) => {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ontime': return 'bg-green-100 text-green-600';
      case 'late': return 'bg-yellow-100 text-yellow-600';
      case 'suspect': return 'bg-red-100 text-red-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ontime': return '准时';
      case 'late': return '延迟';
      case 'suspect': return '可疑';
      default: return '手动';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-xl font-black italic uppercase tracking-tighter">
              新服药记录
            </h3>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
              已在另一设备添加
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="p-4 bg-gray-50 rounded-2xl">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              设备
            </p>
            <p className="text-sm font-black italic">{log.source_device || '未知设备'}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white border border-gray-100 rounded-2xl">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                拍摄时间 (EXIF)
              </p>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-black" />
                <span className="font-black italic text-sm">{formatTime(log.taken_at)}</span>
              </div>
            </div>

            <div className="p-4 bg-white border border-gray-100 rounded-2xl">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                状态
              </p>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-widest ${getStatusColor(log.status)}`}>
                {getStatusText(log.status)}
              </span>
            </div>
          </div>

          {log.status === 'suspect' && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">
              <AlertCircle className="w-4 h-4" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                需要审核：证据提供时间 &gt; 6小时
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button
            onClick={onDismiss}
            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-black italic rounded-full uppercase tracking-tighter hover:bg-gray-200 transition-all"
          >
            稍后
          </button>
          <button
            onClick={onAccept}
            className="flex-1 px-6 py-3 bg-black text-white font-black italic rounded-full uppercase tracking-tighter hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            加载最新
          </button>
        </div>
      </div>
    </div>
  );
};

