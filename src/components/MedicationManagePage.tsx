import React, { useState } from 'react';
import { Plus, Pill, Trash2, X, ChevronLeft, Edit2 } from 'lucide-react';
import type { Medication } from '../types';
import { getDeviceId, upsertMedication } from '../db/localDB';
import { runWithUserAction, getCurrentSnapshotPayload, cloudSaveV2, cloudLoadV2 } from '../services/snapshot';

interface MedicationManagePageProps {
  medications: Medication[];
  onBack: () => void;
  onDataChange: () => void;
}

export const MedicationManagePage: React.FC<MedicationManagePageProps> = ({
  medications,
  onBack,
  onDataChange
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
    runWithUserAction(async () => {
      if (!newMedName || !newMedDosage || !newMedTime) {
        alert('请填写完整信息');
        return;
      }

      let payload = getCurrentSnapshotPayload();
      console.log('🔍 [添加药品] 当前 payload 状态:', payload ? '存在' : 'null');
      
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MedicationManagePage.tsx:38',message:'添加药品-检查 payload',data:{hasPayload:!!payload,localStorageLogin:localStorage.getItem('isLoggedIn')},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      if (!payload) {
        console.warn('⚠️ payload 为 null，尝试重新加载...');
        const loadResult = await cloudLoadV2();
        console.log('🔍 cloudLoadV2 结果:', loadResult);
        
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MedicationManagePage.tsx:50',message:'cloudLoadV2 调用结果',data:{success:loadResult.success,message:loadResult.message},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        payload = getCurrentSnapshotPayload();
        console.log('🔍 重新获取 payload 状态:', payload ? '存在' : '仍为 null');
        
        if (!payload) {
          console.error('❌ payload 初始化失败，cloudLoadV2 返回:', loadResult);
          alert('系统初始化失败，请刷新页面后重试\n\n请打开控制台查看详细日志');
          return;
        }
        
        console.log('✅ payload 已成功初始化');
      }

      const newMedication: Medication = {
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: newMedName,
        dosage: newMedDosage,
        scheduled_time: newMedTime,
        accent: newMedAccent,
        device_id: getDeviceId()
      };

      payload.medications = payload.medications || [];
      payload.medications.push(newMedication);

      // 同时保存到本地数据库
      await upsertMedication(newMedication);
      console.log('✅ 新药品已保存到本地数据库');

      const result = await cloudSaveV2(payload);
      if (!result.success) {
        if (result.conflict) {
          alert('版本冲突，正在重新加载...');
          await cloudLoadV2();
        } else {
          alert(`添加药品失败: ${result.message}`);
        }
        return;
      }

      console.log('✅ 新药品已成功写入 payload 并同步到云端');
      await onDataChange();
      
      setNewMedName('');
      setNewMedDosage('');
      setNewMedTime('');
      setNewMedAccent('#E0F3A2');
    });
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
    
    runWithUserAction(async () => {
      if (!editMedName || !editMedDosage || !editMedTime) {
        alert('请填写完整信息');
        return;
      }

      let payload = getCurrentSnapshotPayload();
      console.log('🔍 [编辑药品] 当前 payload 状态:', payload ? '存在' : 'null');
      
      if (!payload) {
        console.warn('⚠️ payload 为 null，尝试重新加载...');
        const loadResult = await cloudLoadV2();
        console.log('🔍 cloudLoadV2 结果:', loadResult);
        
        payload = getCurrentSnapshotPayload();
        console.log('🔍 重新获取 payload 状态:', payload ? '存在' : '仍为 null');
        
        if (!payload) {
          console.error('❌ payload 初始化失败，cloudLoadV2 返回:', loadResult);
          alert('系统初始化失败，请刷新页面后重试\n\n请打开控制台查看详细日志');
          return;
        }
        
        console.log('✅ payload 已成功初始化');
      }

      // 更新药品信息
      const medIndex = (payload.medications || []).findIndex((m: any) => m.id === editingMed.id);
      if (medIndex !== -1) {
        const updatedMed: Medication = {
          ...payload.medications[medIndex],
          name: editMedName,
          dosage: editMedDosage,
          scheduled_time: editMedTime,
          accent: editMedAccent
        };
        payload.medications[medIndex] = updatedMed;
        
        // 同时更新本地数据库
        await upsertMedication(updatedMed);
        console.log('✅ 药品已更新到本地数据库');
      }

      const result = await cloudSaveV2(payload);
      if (!result.success) {
        if (result.conflict) {
          alert('版本冲突，正在重新加载...');
          await cloudLoadV2();
        } else {
          alert(`更新药品失败: ${result.message}`);
        }
        return;
      }

      console.log('✅ 药品已成功更新并同步到云端');
      await onDataChange();
      setEditingMed(null);
    });
  };

  const handleDeleteMedication = async (med: Medication) => {
    runWithUserAction(async () => {
      if (confirm(`确定要删除"${med.name}"吗？\n相关的服药记录也会被删除。`)) {
        const payload = getCurrentSnapshotPayload();
        if (!payload) {
          alert('系统未初始化，请刷新页面后重试');
          return;
        }

        // 从 payload 中删除药品
        payload.medications = (payload.medications || []).filter((m: any) => m.id !== med.id);
        // 删除相关的服药记录
        payload.medication_logs = (payload.medication_logs || []).filter((l: any) => l.medication_id !== med.id);

        const result = await cloudSaveV2(payload);
        if (!result.success) {
          if (result.conflict) {
            alert('版本冲突，正在重新加载...');
            await cloudLoadV2();
          } else {
            alert(`删除药品失败: ${result.message}`);
          }
          return;
        }

        console.log('✅ 药品已成功从 payload 删除并同步到云端');
        await onDataChange();
      }
    });
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
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={newMedAccent}
                  onChange={(e) => setNewMedAccent(e.target.value)}
                  className="w-16 h-16 rounded-2xl border-2 border-gray-300 cursor-pointer"
                  title="选择颜色"
                />
                <div className="flex-1">
                  <div 
                    className="w-full h-12 rounded-2xl border-2 border-gray-200"
                    style={{ backgroundColor: newMedAccent }}
                  />
                  <p className="text-xs text-gray-500 mt-1 font-mono">{newMedAccent}</p>
                </div>
              </div>
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
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editMedAccent}
                    onChange={(e) => setEditMedAccent(e.target.value)}
                    className="w-16 h-16 rounded-2xl border-2 border-gray-300 cursor-pointer"
                    title="选择颜色"
                  />
                  <div className="flex-1">
                    <div 
                      className="w-full h-12 rounded-2xl border-2 border-gray-200"
                      style={{ backgroundColor: editMedAccent }}
                    />
                    <p className="text-xs text-gray-500 mt-1 font-mono">{editMedAccent}</p>
                  </div>
                </div>
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

