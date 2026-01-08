import React, { useState } from 'react';
import { Plus, Pill, Trash2, X, ChevronLeft, Edit2 } from 'lucide-react';
import type { Medication } from '../types';
import { getDeviceId } from '../db/localDB';
// 【彻底移除 app_state 依赖】不再使用 payload/app_state，只操作 medications 表
// import { runWithUserAction, getCurrentSnapshotPayload, cloudSaveV2, cloudLoadV2 } from '../services/snapshot'; // ❌ 已移除
// 【云端化】引入纯云端服务
import { upsertMedicationToCloud, deleteMedicationFromCloud } from '../services/cloudOnly';

function generateUUID(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cryptoAny = crypto as any;
  if (cryptoAny?.randomUUID) return cryptoAny.randomUUID();
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface MedicationManagePageProps {
  medications: Medication[];
  onBack: () => void;
  onDataChange: () => void;
  // 【Optimistic UI】新增：用于立即更新本地 state 的回调
  onMedicationUpdated?: (medication: Medication) => void;
  onMedicationDeleted?: (medicationId: string) => void;
  onMedicationAdded?: (medication: Medication) => void;
}

export const MedicationManagePage: React.FC<MedicationManagePageProps> = ({
  medications,
  onBack,
  onDataChange,
  onMedicationUpdated,
  onMedicationDeleted,
  onMedicationAdded
}) => {
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedTime, setNewMedTime] = useState('');
  const [newMedAccent, setNewMedAccent] = useState<string>('#E0F3A2'); // 默认柠檬绿色
  
  // 编辑状态
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [editMedName, setEditMedName] = useState('');
  const [editMedDosage, setEditMedDosage] = useState('');
  const [editMedTime, setEditMedTime] = useState('');
  const [editMedAccent, setEditMedAccent] = useState<string>('#E0F3A2');

  const handleAddMedication = async () => {
    // 【彻底移除 app_state 依赖】不再使用 payload/app_state，只操作 medications 表
    if (!newMedName || !newMedDosage || !newMedTime) {
      alert('请填写完整信息');
      return;
    }

    const newMedication: Medication = {
        // 关键修复：创建时直接生成 UUID，避免 local_xxx → UUID 的双写/重复/23502
        id: generateUUID(),
        name: newMedName,
        dosage: newMedDosage,
        scheduled_time: newMedTime,
        accent: newMedAccent,
        device_id: getDeviceId()
      };

      // 【Optimistic UI】立即更新本地 state（UI 立即生效）
      if (onMedicationAdded) {
        onMedicationAdded(newMedication);
      }
      
      // 【云端化】后台异步写入云端，不阻塞 UI
      try {
        const savedMed = await upsertMedicationToCloud(newMedication);
        if (!savedMed) {
          // 失败时回滚：从本地 state 移除
          if (onMedicationDeleted) {
            onMedicationDeleted(newMedication.id);
          }
          alert('添加药品失败，请重试');
          return;
        }
        console.log('✅ 新药品已直接写入云端:', savedMed.name);
        
        // 成功：用云端返回的数据更新本地 state（确保 ID 等字段一致）
        if (onMedicationUpdated && savedMed.id !== newMedication.id) {
          onMedicationDeleted?.(newMedication.id);
          onMedicationAdded?.(savedMed);
        }
      } catch (error: any) {
        // 失败时回滚
        if (onMedicationDeleted) {
          onMedicationDeleted(newMedication.id);
        }
        const errorMsg = error?.message || '添加药品失败，请重试';
        console.error('❌ 添加药品失败:', errorMsg, error);
        alert(`添加药品失败: ${errorMsg}`);
        return;
      }
      
      // 【禁止全量 reload】不再调用 onDataChange()，只做局部更新
      // await onDataChange(); // 已移除
      
      setNewMedName('');
      setNewMedDosage('');
      setNewMedTime('');
      setNewMedAccent('#E0F3A2');
  };

  const handleEditMedication = (med: Medication) => {
    setEditingMed(med);
    setEditMedName(med.name);
    setEditMedDosage(med.dosage);
    setEditMedTime(med.scheduled_time);
    setEditMedAccent(med.accent || '#E0F3A2');
  };

  const handleSaveEdit = async () => {
    if (!editingMed) return;
    
    // 【彻底移除 app_state 依赖】不再使用 payload/app_state，只操作 medications 表
    if (!editMedName || !editMedDosage || !editMedTime) {
      alert('请填写完整信息');
      return;
    }

    // 【Optimistic UI】立即更新本地 state（UI 立即生效）
      const updatedMed: Medication = {
        ...editingMed,
        name: editMedName,
        dosage: editMedDosage,
        scheduled_time: editMedTime,
        accent: editMedAccent
      };
      
      // 保存原始值用于回滚
      const originalMed = { ...editingMed };
      
      // 立即更新 UI
      if (onMedicationUpdated) {
        onMedicationUpdated(updatedMed);
      }
      
      // 【修复A】云端写入成功后立即用返回数据更新本地 state（确保颜色立即生效）
      try {
        const savedMed = await upsertMedicationToCloud(updatedMed);
        if (!savedMed) {
          // 失败时回滚：恢复原始值
          if (onMedicationUpdated) {
            onMedicationUpdated(originalMed);
          }
          alert('更新药品失败，请重试');
          return;
        }
        console.log('✅ 药品已直接更新到云端:', savedMed.name, { accent: savedMed.accent });
        
        // 【修复A】立即用云端返回的数据更新本地 state（包括 accent 颜色）
        // 这确保本机立即生效，不等待 Realtime
        if (onMedicationUpdated) {
          onMedicationUpdated(savedMed);
          console.log('✅ [修复A] 本机 state 已立即更新（包括颜色）:', savedMed.accent);
        }
      } catch (error: any) {
        // 失败时回滚
        if (onMedicationUpdated) {
          onMedicationUpdated(originalMed);
        }
        const errorMsg = error?.message || '更新药品失败，请重试';
        console.error('❌ 更新药品失败:', errorMsg, error);
        alert(`更新药品失败: ${errorMsg}`);
        return;
      }
      
      // 【禁止全量 reload】不再调用 onDataChange()，只做局部更新
      // await onDataChange(); // 已移除
      
      setEditingMed(null);
  };

  const handleDeleteMedication = async (med: Medication) => {
    // 【彻底移除 app_state 依赖】不再使用 payload/app_state，只操作 medications 表
    if (confirm(`确定要删除"${med.name}"吗？\n相关的服药记录也会被删除。`)) {
        // 【Optimistic UI】立即从本地 state 移除（UI 立即生效）
        if (onMedicationDeleted) {
          onMedicationDeleted(med.id);
        }
        
        // 【云端化】后台异步删除云端，不阻塞 UI
        try {
          const success = await deleteMedicationFromCloud(med.id);
          if (!success) {
            // 失败时回滚：重新添加回本地 state
            if (onMedicationAdded) {
              onMedicationAdded(med);
            }
            alert('删除药品失败，请重试');
            return;
          }

          console.log('✅ 药品已从云端删除:', med.name);
        } catch (error: any) {
          // 失败时回滚
          if (onMedicationAdded) {
            onMedicationAdded(med);
          }
          const errorMsg = error?.message || '删除药品失败，请重试';
          console.error('❌ 删除药品失败:', errorMsg, error);
          alert(`删除药品失败: ${errorMsg}`);
          return;
        }
        
        // 【禁止全量 reload】不再调用 onDataChange()，只做局部更新
        // await onDataChange(); // 已移除
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-black italic tracking-tighter">
            药品管理
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* 添加新药品 */}
        <div className="mb-8 p-6 bg-gradient-to-br from-pink-50 to-purple-50 rounded-3xl border-2 border-pink-100">
          <h2 className="text-lg font-black italic tracking-tighter mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            添加新药品
          </h2>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">药品名称</label>
              <input
                type="text"
                value={newMedName}
                onChange={(e) => setNewMedName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-pink-500 focus:outline-none font-medium"
                placeholder="例如：降压药"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">剂量</label>
              <input
                type="text"
                value={newMedDosage}
                onChange={(e) => setNewMedDosage(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-pink-500 focus:outline-none font-medium"
                placeholder="例如：1片"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">服用时间</label>
              <input
                type="time"
                value={newMedTime}
                onChange={(e) => setNewMedTime(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-pink-500 focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">颜色主题</label>
              <div className="grid grid-cols-6 gap-3">
                {[
                  { value: '#E0F3A2', label: '青柠' },
                  { value: '#FFD1DC', label: '浆果' },
                  { value: '#BFEFFF', label: '薄荷' },
                  { value: '#A8D8FF', label: '蓝色' },
                  { value: '#D4A5FF', label: '紫色' },
                  { value: '#FFB84D', label: '橙色' },
                  { value: '#FF6B6B', label: '红色' },
                  { value: '#4ECDC4', label: '青色' },
                ].map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setNewMedAccent(color.value)}
                    className={`h-12 rounded-xl border-2 transition-all ${
                      newMedAccent === color.value
                        ? 'border-black scale-110 shadow-lg'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                已选择: {[
                  { value: '#E0F3A2', label: '青柠' },
                  { value: '#FFD1DC', label: '浆果' },
                  { value: '#BFEFFF', label: '薄荷' },
                  { value: '#A8D8FF', label: '蓝色' },
                  { value: '#D4A5FF', label: '紫色' },
                  { value: '#FFB84D', label: '橙色' },
                  { value: '#FF6B6B', label: '红色' },
                  { value: '#4ECDC4', label: '青色' },
                ].find(c => c.value === newMedAccent)?.label || '自定义'}
              </p>
            </div>

            <button
              onClick={handleAddMedication}
              className="w-full px-6 py-4 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black italic rounded-full tracking-tighter hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              添加药品
            </button>
          </div>
        </div>

        {/* 现有药品列表 */}
        <div>
          <h2 className="text-lg font-black italic tracking-tighter mb-4">当前药品列表</h2>
          
          {medications.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-3xl">
              <Pill className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="font-bold text-lg">暂无药品</p>
              <p className="text-sm mt-2">点击上方"添加新药品"开始添加</p>
            </div>
          ) : (
            <div className="space-y-3">
              {medications.map((med) => {
                const medColor = med.accent || '#E0F3A2';
                return (
                  <div
                    key={med.id}
                    className="p-5 rounded-2xl border-2 flex items-center justify-between bg-white"
                    style={{ borderColor: medColor }}
                  >
                    <div className="flex-1">
                      <h3 className="font-black italic tracking-tighter text-lg">{med.name}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-sm font-bold text-gray-600">{med.dosage}</span>
                        <span className="text-xs font-black bg-black text-white px-3 py-1 rounded-full italic">
                          {med.scheduled_time}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleEditMedication(med)}
                        className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-all"
                        title="编辑药品"
                      >
                        <Edit2 className="w-5 h-5 text-blue-600" />
                      </button>
                      <button
                        onClick={() => handleDeleteMedication(med)}
                        className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center hover:bg-red-200 transition-all"
                        title="删除药品"
                      >
                        <Trash2 className="w-5 h-5 text-red-600" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* 编辑药品模态框 */}
      {editingMed && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black italic tracking-tighter">编辑药品</h3>
              <button
                onClick={() => setEditingMed(null)}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">药品名称</label>
                <input
                  type="text"
                  value={editMedName}
                  onChange={(e) => setEditMedName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-pink-500 focus:outline-none font-medium"
                  placeholder="例如：降压药"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">剂量</label>
                <input
                  type="text"
                  value={editMedDosage}
                  onChange={(e) => setEditMedDosage(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-pink-500 focus:outline-none font-medium"
                  placeholder="例如：1片"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">服用时间</label>
                <input
                  type="time"
                  value={editMedTime}
                  onChange={(e) => setEditMedTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-pink-500 focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">颜色主题</label>
                <div className="grid grid-cols-6 gap-3">
                  {[
                    { value: '#E0F3A2', label: '青柠' },
                    { value: '#FFD1DC', label: '浆果' },
                    { value: '#BFEFFF', label: '薄荷' },
                    { value: '#A8D8FF', label: '蓝色' },
                    { value: '#D4A5FF', label: '紫色' },
                    { value: '#FFB84D', label: '橙色' },
                    { value: '#FF6B6B', label: '红色' },
                    { value: '#4ECDC4', label: '青色' },
                  ].map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setEditMedAccent(color.value)}
                      className={`h-12 rounded-xl border-2 transition-all ${
                        editMedAccent === color.value
                          ? 'border-black scale-110 shadow-lg'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  已选择: {[
                    { value: '#E0F3A2', label: '青柠' },
                    { value: '#FFD1DC', label: '浆果' },
                    { value: '#BFEFFF', label: '薄荷' },
                    { value: '#A8D8FF', label: '蓝色' },
                    { value: '#D4A5FF', label: '紫色' },
                    { value: '#FFB84D', label: '橙色' },
                    { value: '#FF6B6B', label: '红色' },
                    { value: '#4ECDC4', label: '青色' },
                  ].find(c => c.value === editMedAccent)?.label || '自定义'}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setEditingMed(null)}
                  className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 font-black italic rounded-full tracking-tighter hover:bg-gray-200 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black italic rounded-full tracking-tighter hover:scale-105 active:scale-95 transition-all"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

