import { useState, useEffect } from 'react';
import { getMedications } from '../services/medication';
import { getMedicationLogs } from '../services/logs';
import ProgressRing from './ProgressRing';
import type { Medication } from '../../shared/types';

export default function TodayProgress() {
  const [percentage, setPercentage] = useState(0);
  const [total, setTotal] = useState(0);
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    calculateProgress();
  }, []);

  const calculateProgress = async () => {
    try {
      const medications = await getMedications();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // 获取今日所有记录
      const allLogs = await getMedicationLogs();
      const todayLogs = allLogs.filter(log => {
        const logDate = new Date(log.taken_at);
        return logDate >= today && logDate < tomorrow;
      });

      // 统计已服用的药品（去重）
      const takenMedicationIds = new Set(todayLogs.map(log => log.medication_id));
      
      setTotal(medications.length);
      setCompleted(takenMedicationIds.size);
      
      const percent = medications.length > 0
        ? (takenMedicationIds.size / medications.length) * 100
        : 0;
      setPercentage(percent);
    } catch (error) {
      console.error('计算进度失败:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">今日进度</h3>
      <div className="flex items-center justify-center mb-4">
        <ProgressRing percentage={percentage} />
      </div>
      <div className="text-center text-sm text-gray-600">
        <p>已完成 {completed} / {total} 个药品</p>
      </div>
    </div>
  );
}

