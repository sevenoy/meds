// 相机拍照组件

import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, Upload, AlertCircle, Calendar, Clock } from 'lucide-react';
import { recordMedicationIntake } from '../services/medication';
import { fileToDataURL } from '../utils/crypto';
import { extractTakenAt } from '../utils/exif';
import type { Medication } from '../types';

import type { MedicationLog } from '../types';

interface CameraModalProps {
  medications: Medication[]; // 改为所有药品列表
  onClose: () => void;
  onSuccess: (log: MedicationLog) => void; // 【修复 B】传递新创建的 log
  preselectedMedicationId?: string | null; // 新增：预选的药品ID
}

export const CameraModal: React.FC<CameraModalProps> = ({ medications, onClose, onSuccess, preselectedMedicationId }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedMedicationId, setSelectedMedicationId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 日期时间确认
  const [detectedDate, setDetectedDate] = useState<Date>(new Date());
  const [confirmedDate, setConfirmedDate] = useState('');
  const [confirmedTime, setConfirmedTime] = useState('');
  const [timeSource, setTimeSource] = useState<'exif' | 'system'>('system');

  useEffect(() => {
    if (medications.length > 0) {
      // 优先使用预选的药品ID，否则使用第一个
      if (preselectedMedicationId && medications.find(m => m.id === preselectedMedicationId)) {
        setSelectedMedicationId(preselectedMedicationId);
      } else {
        setSelectedMedicationId(medications[0].id);
      }
    }
  }, [medications, preselectedMedicationId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型（包括 HEIC/HEIF）
    const isImage = file.type.startsWith('image/') ||
                    file.name.toLowerCase().endsWith('.heic') ||
                    file.name.toLowerCase().endsWith('.heif');
    
    if (!isImage) {
      setError('请选择图片文件');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // 创建预览（HEIC 会自动转换为 JPEG）
    try {
      const dataURL = await fileToDataURL(file);
      setPreview(dataURL);

      // 提取 EXIF 时间
      const { takenAt, source } = await extractTakenAt(file);
      setDetectedDate(takenAt || new Date());
      setTimeSource(source);
      
      // 格式化日期和时间
      const date = takenAt || new Date();
      setConfirmedDate(date.toISOString().split('T')[0]); // YYYY-MM-DD
      setConfirmedTime(date.toTimeString().slice(0, 5)); // HH:MM
      
      // 进入确认步骤
      setStep('confirm');
    } catch (err) {
      console.error('预览生成失败:', err);
      setError('图片预览生成失败');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedMedicationId) return;

    setUploading(true);
    setError(null);

    try {
      // 组合用户确认的日期和时间
      const confirmedDateTime = new Date(`${confirmedDate}T${confirmedTime}`);
      
      // 检查当天是否已有该药品的记录
      const { getMedicationLogs } = await import('../db/localDB');
      const existingLogs = await getMedicationLogs(selectedMedicationId);
      const confirmedDateStr = confirmedDateTime.toISOString().split('T')[0];
      
      const hasTodayLog = existingLogs.some(log => {
        const logDate = new Date(log.taken_at).toISOString().split('T')[0];
        return logDate === confirmedDateStr;
      });
      
      if (hasTodayLog) {
        const selectedMed = medications.find(m => m.id === selectedMedicationId);
        const medName = selectedMed?.name || '该药品';
        const dateDisplay = confirmedDateStr === new Date().toISOString().split('T')[0] 
          ? '今天' 
          : new Date(confirmedDateStr).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
        
        if (!confirm(`⚠️ 提醒：${dateDisplay}已经记录过${medName}的服药记录。\n\n确定要再次添加吗？`)) {
          setUploading(false);
          return;
        }
      }
      
      // 【修复 B】云端 upsert 成功后，立即返回结果并更新 UI
      const savedLog = await recordMedicationIntake(selectedMedicationId, selectedFile, confirmedDateTime);
      
      // 显示成功提示
      alert('✅ 服药记录已成功添加！');
      
      // 【修复 B】传递 savedLog 给 onSuccess，让 App 立即更新 state
      onSuccess(savedLog);
      onClose();
    } catch (err) {
      // 【修复 B】捕获 bucket 不存在的错误并明确提示
      const errorMessage = err instanceof Error ? err.message : '上传失败，请重试';
      if (errorMessage.includes('Storage bucket medication-images 不存在')) {
        setError('Storage bucket medication-images 不存在，请先创建 bucket。请在 Supabase Dashboard 中创建该 bucket。');
        alert('❌ Storage bucket medication-images 不存在，请先创建 bucket\n\n请在 Supabase Dashboard 中创建该 bucket 后再试。');
      } else {
        setError(errorMessage);
      }
    } finally {
      setUploading(false);
    }
  };

  const selectedMed = medications.find(m => m.id === selectedMedicationId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, rgba(243, 232, 255, 0.95) 0%, rgba(232, 225, 255, 0.95) 100%)', backdropFilter: 'blur(8px)' }}>
      <div className="bg-white rounded-[40px] p-8 max-w-lg w-full shadow-2xl" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-black italic tracking-tighter">
            {step === 'select' ? '添加服药记录' : '确认信息'}
          </h3>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'select' && !preview && (
          <div className="space-y-4">
            {/* 选择药品 */}
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">选择药品</label>
              <select
                value={selectedMedicationId}
                onChange={(e) => setSelectedMedicationId(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-blue-500 focus:outline-none font-bold"
              >
                {medications.map(med => (
                  <option key={med.id} value={med.id}>
                    {med.name} - {med.dosage} ({med.scheduled_time})
                  </option>
                ))}
              </select>
            </div>

            {/* 上传照片 */}
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">上传照片</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-video rounded-2xl bg-gray-100 border-4 border-dashed border-gray-300 flex flex-col items-center justify-center gap-4 hover:bg-gray-50 transition-all"
              >
                <Camera className="w-16 h-16 text-gray-400" />
                <div className="text-center">
                  <p className="text-sm font-black italic tracking-tighter mb-1">
                    拍照或从相册选择
                  </p>
                  <p className="text-xs text-gray-400 font-bold tracking-widest">
                    支持 HEIC/JPEG/PNG 格式
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {step === 'confirm' && preview && (
          <div className="space-y-4">
            {/* 照片预览 */}
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-gray-100">
              <img
                src={preview}
                alt="预览"
                className="w-full h-full object-cover"
              />
            </div>

            {/* 药品信息 */}
            <div className="p-4 bg-gray-50 rounded-2xl">
              <p className="text-xs font-bold text-gray-500 mb-1">药品</p>
              <p className="text-lg font-black italic">{selectedMed?.name}</p>
              <p className="text-sm text-gray-600 font-bold">{selectedMed?.dosage}</p>
            </div>

            {/* 日期时间确认 */}
            <div className="p-4 bg-blue-50 rounded-2xl border-2 border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                <p className="text-sm font-black text-blue-900">
                  {timeSource === 'exif' ? '✅ 已从照片读取时间' : '⚠️ 照片无 EXIF，请手动设置'}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    服药日期
                  </label>
                  <input
                    type="date"
                    value={confirmedDate}
                    onChange={(e) => setConfirmedDate(e.target.value)}
                    className="w-full max-w-full px-3 py-3 rounded-xl border-2 border-blue-300 focus:border-blue-500 focus:outline-none font-bold text-base"
                    style={{ WebkitAppearance: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    服药时间
                  </label>
                  <input
                    type="time"
                    value={confirmedTime}
                    onChange={(e) => setConfirmedTime(e.target.value)}
                    className="w-full max-w-full px-3 py-3 rounded-xl border-2 border-blue-300 focus:border-blue-500 focus:outline-none font-bold text-base"
                    style={{ WebkitAppearance: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            {/* 按钮 */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('select');
                  setPreview(null);
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-black italic rounded-full tracking-tighter hover:bg-gray-200 transition-all"
              >
                重新选择
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-black italic rounded-full tracking-tighter hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {uploading ? (
                  <>上传中...</>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    确认上传
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">
            <AlertCircle className="w-4 h-4" />
            <p className="text-xs font-bold tracking-widest">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};



