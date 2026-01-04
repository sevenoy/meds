import { useState, useEffect } from 'react';
import { Clock, Camera, CheckCircle2, AlertCircle } from 'lucide-react';
import { getRecentLogs } from '../services/logs';
import { getMedications } from '../services/medication';
import type { MedicationLog } from '../../shared/types';
import { formatDate, formatTime } from '../utils/index';

interface LogWithMedication extends MedicationLog {
  medicationName?: string;
}

export default function LogHistory() {
  const [logs, setLogs] = useState<LogWithMedication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const recentLogs = await getRecentLogs(7);
      const medications = await getMedications();
      const medMap = new Map(medications.map(m => [m.id, m.name]));

      const logsWithNames: LogWithMedication[] = recentLogs.map(log => ({
        ...log,
        medicationName: medMap.get(log.medication_id)
      }));

      setLogs(logsWithNames);
    } catch (error) {
      console.error('加载记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ontime':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'late':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ontime':
        return '按时';
      case 'late':
        return '延迟';
      case 'manual':
        return '手动';
      default:
        return '未知';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">最近7天记录</h3>
      
      {logs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>还没有服药记录</p>
          <p className="text-sm mt-2">点击药品卡片上的"拍照记录"按钮开始记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex-shrink-0">
                {log.image_path ? (
                  <img
                    src={log.image_path}
                    alt="服药照片"
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                    <Camera className="w-8 h-8 text-gray-400" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-lg">
                    {log.medicationName || '未知药品'}
                  </h4>
                  {getStatusIcon(log.status)}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatTime(log.taken_at)}
                  </span>
                  <span>{getStatusText(log.status)}</span>
                  <span className="text-xs text-gray-400">
                    {formatDate(log.taken_at)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

