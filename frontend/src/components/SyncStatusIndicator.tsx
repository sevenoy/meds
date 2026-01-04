import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

interface SyncStatusIndicatorProps {
  status: 'synced' | 'syncing' | 'error';
  lastSyncTime?: Date | string;
  errorMessage?: string;
}

export default function SyncStatusIndicator({
  status,
  lastSyncTime,
  errorMessage
}: SyncStatusIndicatorProps) {
  const formatTime = (time: Date | string) => {
    const date = typeof time === 'string' ? new Date(time) : time;
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      {status === 'synced' && (
        <>
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-gray-600">
            {lastSyncTime ? `已同步 ${formatTime(lastSyncTime)}` : '已同步'}
          </span>
        </>
      )}
      {status === 'syncing' && (
        <>
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          <span className="text-gray-600">同步中...</span>
        </>
      )}
      {status === 'error' && (
        <>
          <XCircle className="w-4 h-4 text-red-500" />
          <span className="text-red-600">
            {errorMessage || '同步失败'}
          </span>
        </>
      )}
    </div>
  );
}

