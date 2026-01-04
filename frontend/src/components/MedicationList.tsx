import { useState, useEffect } from 'react';
import { Plus, Camera, Edit, Trash2, Clock } from 'lucide-react';
import type { Medication } from '../../shared/types';
import { getMedications, deleteMedication } from '../services/medication';
import { addMedicationLog } from '../services/logs';
import AddMedicationModal from './AddMedicationModal';
import CameraModal from './CameraModal';

export default function MedicationList() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | undefined>();
  const [selectedMedication, setSelectedMedication] = useState<Medication | undefined>();

  useEffect(() => {
    loadMedications();
  }, []);

  const loadMedications = async () => {
    try {
      const meds = await getMedications();
      setMedications(meds);
    } catch (error) {
      console.error('加载药品失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingMedication(undefined);
    setShowAddModal(true);
  };

  const handleEdit = (med: Medication) => {
    setEditingMedication(med);
    setShowAddModal(true);
  };

  const handleDelete = async (medId: string) => {
    if (!confirm('确定要删除这个药品吗？')) return;
    
    try {
      await deleteMedication(medId);
      await loadMedications();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
    }
  };

  const handleTakePhoto = (med: Medication) => {
    setSelectedMedication(med);
    setShowCameraModal(true);
  };

  const handlePhotoCaptured = async (imageData: string, takenAt: Date, timeSource: 'exif' | 'system' | 'manual') => {
    if (!selectedMedication) return;

    try {
      await addMedicationLog(
        selectedMedication.id,
        imageData,
        takenAt,
        timeSource
      );
      
      // 显示成功提示
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in';
      notification.textContent = '✅ 服药记录已保存';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.classList.add('animate-fade-out');
        setTimeout(() => notification.remove(), 300);
      }, 3000);

      await loadMedications();
    } catch (error) {
      console.error('保存记录失败:', error);
      alert('保存失败，请重试');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
      </div>
    );
  }

  const getAccentColor = (accent?: string) => {
    const colors: Record<string, string> = {
      lime: 'bg-lime-500',
      berry: 'bg-pink-500',
      mint: 'bg-emerald-500',
      blue: 'bg-blue-500',
      purple: 'bg-purple-500',
      orange: 'bg-orange-500',
    };
    return colors[accent || 'lime'] || colors.lime;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold">今日药品</h3>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>添加药品</span>
        </button>
      </div>

      {medications.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>还没有添加药品</p>
          <p className="text-sm mt-2">点击上方按钮添加第一个药品</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {medications.map((med) => (
            <div
              key={med.id}
              className="bg-white rounded-lg shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-4 h-4 rounded-full ${getAccentColor(med.accent)}`} />
                    <h4 className="text-xl font-bold">{med.name}</h4>
                  </div>
                  <p className="text-gray-600 mb-2">剂量: {med.dosage}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>{med.scheduled_time}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleTakePhoto(med)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-semibold"
                >
                  <Camera className="w-4 h-4" />
                  拍照记录
                </button>
                <button
                  onClick={() => handleEdit(med)}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  title="编辑"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(med.id)}
                  className="px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddMedicationModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadMedications}
        medication={editingMedication}
      />

      <CameraModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={handlePhotoCaptured}
        medicationName={selectedMedication?.name}
      />
    </div>
  );
}

