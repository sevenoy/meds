import { useState } from 'react';
import { X } from 'lucide-react';
import type { Medication } from '../../shared/types';
import { upsertMedication } from '../services/medication';

interface AddMedicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  medication?: Medication; // 编辑模式
}

const ACCENT_COLORS = [
  { value: 'lime', label: '青柠', class: 'bg-lime-500' },
  { value: 'berry', label: '浆果', class: 'bg-pink-500' },
  { value: 'mint', label: '薄荷', class: 'bg-emerald-500' },
  { value: 'blue', label: '蓝色', class: 'bg-blue-500' },
  { value: 'purple', label: '紫色', class: 'bg-purple-500' },
  { value: 'orange', label: '橙色', class: 'bg-orange-500' },
];

export default function AddMedicationModal({
  isOpen,
  onClose,
  onSuccess,
  medication
}: AddMedicationModalProps) {
  const [name, setName] = useState(medication?.name || '');
  const [dosage, setDosage] = useState(medication?.dosage || '');
  const [scheduledTime, setScheduledTime] = useState(medication?.scheduled_time || '09:00');
  const [accent, setAccent] = useState(medication?.accent || 'lime');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const med: Medication = {
        id: medication?.id || crypto.randomUUID(),
        name: name.trim(),
        dosage: dosage.trim(),
        scheduled_time: scheduledTime,
        accent: accent,
        created_at: medication?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await upsertMedication(med);
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName(medication?.name || '');
    setDosage(medication?.dosage || '');
    setScheduledTime(medication?.scheduled_time || '09:00');
    setAccent(medication?.accent || 'lime');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold">
            {medication ? '编辑药品' : '添加药品'}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              药品名称 *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例如：阿司匹林"
            />
          </div>

          <div>
            <label htmlFor="dosage" className="block text-sm font-medium text-gray-700 mb-2">
              剂量 *
            </label>
            <input
              id="dosage"
              type="text"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例如：1片"
            />
          </div>

          <div>
            <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-2">
              服药时间 *
            </label>
            <input
              id="time"
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              颜色主题
            </label>
            <div className="grid grid-cols-6 gap-3">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setAccent(color.value)}
                  className={`h-12 rounded-lg border-2 transition-all ${
                    accent === color.value
                      ? 'border-black scale-110'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className={`w-full h-full rounded-lg ${color.class}`} />
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              选择: {ACCENT_COLORS.find(c => c.value === accent)?.label}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '保存中...' : medication ? '更新' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

