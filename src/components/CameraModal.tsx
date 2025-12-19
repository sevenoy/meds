// 相机拍照组件

import React, { useRef, useState } from 'react';
import { Camera, X, Upload, AlertCircle } from 'lucide-react';
import { recordMedicationIntake } from '../services/medication';
import { fileToDataURL } from '../utils/crypto';
import type { Medication } from '../types';

interface CameraModalProps {
  medication: Medication;
  onClose: () => void;
  onSuccess: () => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ medication, onClose, onSuccess }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      console.error('预览生成失败:', err);
      setError('图片预览生成失败');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      await recordMedicationIntake(medication.id, selectedFile);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[40px] p-8 max-w-lg w-full shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-1">
              {medication.name}
            </h3>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
              {medication.dosage}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {preview ? (
          <div className="mb-6">
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-4">
              <img
                src={preview}
                alt="预览"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setPreview(null);
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-black italic rounded-full uppercase tracking-tighter hover:bg-gray-200 transition-all"
              >
                重新选择
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 px-6 py-3 bg-black text-white font-black italic rounded-full uppercase tracking-tighter hover:bg-gray-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
        ) : (
          <div className="mb-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-square rounded-2xl bg-gray-100 border-4 border-dashed border-gray-300 flex flex-col items-center justify-center gap-4 hover:bg-gray-50 transition-all"
            >
              <Camera className="w-16 h-16 text-gray-400" />
              <div className="text-center">
                <p className="text-sm font-black italic uppercase tracking-tighter mb-1">
                  点击拍照
                </p>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                  系统将自动提取 EXIF 时间
                </p>
              </div>
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">
            <AlertCircle className="w-4 h-4" />
            <p className="text-xs font-bold uppercase tracking-widest">{error}</p>
          </div>
        )}

        <div className="text-center mt-4">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            ⚠️ 截图或转发图片可能没有 EXIF 时间戳
          </p>
        </div>
      </div>
    </div>
  );
};



