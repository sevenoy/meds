import React, { useState, useRef } from 'react';
import { Camera, X, Upload, Calendar, Clock, Check, Loader2, AlertCircle } from 'lucide-react';
import { Medication, MedicationLog } from '../types';
import { logger } from '../utils/logger';
import exifr from 'exifr';
import heic2any from 'heic2any';
import { addLogToCloud } from '../services/cloudOnly';
import { supabase, getCurrentUserId } from '../lib/supabase';

interface BatchUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    medications: Medication[];
    onSuccess: () => void;
}

interface UploadItem {
    file: File;
    previewUrl: string;
    takenAt: Date;
    selected: boolean;
    status: 'pending' | 'uploading' | 'success' | 'error';
    errorMessage?: string;
    uploadProgress?: number;
}

/**
 * 从文件名提取时间
 * 支持格式: 
 * - IMG_20231105_204500.jpg
 * - 2023-11-05_20-45-00.jpg
 * - IMG_20231105.jpg (只有日期)
 */
function extractTimeFromFilename(filename: string): Date | null {
    // 格式1: IMG_YYYYMMDD_HHMMSS 或 YYYYMMDD_HHMMSS
    const pattern1 = /(\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/;
    const match1 = filename.match(pattern1);
    if (match1) {
        const [, year, month, day, hour, minute, second] = match1;
        return new Date(+year, +month - 1, +day, +hour, +minute, +second);
    }

    // 格式2: YYYY-MM-DD_HH-MM-SS (带连字符)
    const pattern2 = /(\d{4})-(\d{2})-(\d{2})[_T](\d{2})-(\d{2})-(\d{2})/;
    const match2 = filename.match(pattern2);
    if (match2) {
        const [, year, month, day, hour, minute, second] = match2;
        return new Date(+year, +month - 1, +day, +hour, +minute, +second);
    }

    // 格式3: 只有日期 YYYYMMDD (默认时间 12:00:00)
    const pattern3 = /(\d{4})(\d{2})(\d{2})/;
    const match3 = filename.match(pattern3);
    if (match3) {
        const [, year, month, day] = match3;
        return new Date(+year, +month - 1, +day, 12, 0, 0);
    }

    return null;
}

/**
 * 统一处理图片格式，将 HEIC 转换为 JPEG
 * 并保留 EXIF 信息
 */
async function normalizeImageFile(file: File): Promise<File & { _originalExif?: any }> {
    // 检测 HEIC 格式
    const isHEIC =
        file.type === 'image/heic' ||
        file.type === 'image/heif' ||
        (file.type === '' && /\.heic$/i.test(file.name));

    if (isHEIC) {
        console.log('[HEIC_CONVERT] start:', file.name, 'type:', file.type, 'size:', file.size);

        // ✅ 关键修复：转换前先提取 EXIF
        let originalExif: any = null;
        try {
            originalExif = await exifr.parse(file);
            if (originalExif?.DateTimeOriginal) {
                console.log('[HEIC_CONVERT] extracted EXIF DateTimeOriginal:', originalExif.DateTimeOriginal);
            }
        } catch (e) {
            console.warn('[HEIC_CONVERT] EXIF extraction failed:', e);
        }

        try {
            const convertedBlob = await heic2any({
                blob: file,
                toType: 'image/jpeg',
                quality: 0.9
            });

            const newFile = new File(
                [convertedBlob as Blob],
                file.name.replace(/\.heic$/i, '.jpg'),
                { type: 'image/jpeg' }
            ) as File & { _originalExif?: any };

            // ✅ 将原始 EXIF 附加到转换后的文件
            if (originalExif) {
                newFile._originalExif = originalExif;
                console.log('[HEIC_CONVERT] attached EXIF to converted file');
            }

            console.log('[HEIC_CONVERT] success:', newFile.name, 'type:', newFile.type, 'size:', newFile.size);
            return newFile;
        } catch (error) {
            console.error('[HEIC_CONVERT] failed:', error);
            return file as File & { _originalExif?: any };
        }
    }

    return file as File & { _originalExif?: any };
}

/**
 * 重试包装函数
 * @param fn 要执行的异步函数
 * @param times 重试次数（默认 2 次）
 * @param delay 重试间隔（毫秒，默认 1000ms）
 * @returns Promise
 */
async function retry<T>(
    fn: () => Promise<T>,
    times: number = 2,
    delay: number = 1000
): Promise<T> {
    let lastError: any;
    for (let i = 0; i < times; i++) {
        try {
            return await fn();
        } catch (e) {
            lastError = e;
            console.warn(`[RETRY] attempt ${i + 1}/${times} failed:`, e);
            if (i < times - 1) {
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
}

/**
 * 从照片中解析拍摄时间
 * 优先级: 附加的 EXIF → EXIF → 文件名 → file.lastModified
 * @param file 照片文件
 * @returns 拍摄时间和来源，失败返回 null
 */
async function resolveTakenAt(file: File & { _originalExif?: any }): Promise<{ date: Date; source: string } | null> {
    // 0️⃣ 优先检查附加的 EXIF（HEIC 转换前提取的）
    if (file._originalExif?.DateTimeOriginal) {
        const date = new Date(file._originalExif.DateTimeOriginal);
        console.log('[TIME_RESOLVE] from attached EXIF:', file.name, '→', date.toISOString());
        return { date, source: 'exif' };
    }

    // 1️⃣ EXIF DateTimeOriginal
    try {
        const exif = await exifr.parse(file);
        if (exif?.DateTimeOriginal) {
            const date = new Date(exif.DateTimeOriginal);
            console.log('[TIME_RESOLVE] from EXIF:', file.name, '→', date.toISOString());
            return { date, source: 'exif' };
        }
    } catch (e) {
        console.warn('[TIME_RESOLVE] EXIF parse failed, continue fallback:', file.name);
    }

    // 2️⃣ 文件名中的日期时间
    const fromName = extractTimeFromFilename(file.name);
    if (fromName) {
        console.log('[TIME_RESOLVE] from filename:', file.name, '→', fromName.toISOString());
        return { date: fromName, source: 'filename' };
    }

    // 3️⃣ file.lastModified（允许兜底）
    if (file.lastModified && file.lastModified > 0) {
        const date = new Date(file.lastModified);
        console.log('[TIME_RESOLVE] from lastModified:', file.name, '→', date.toISOString());
        return { date, source: 'lastModified' };
    }

    // ❌ 不允许 new Date()，返回 null
    console.warn('[TIME_RESOLVE] failed:', file.name, '→ null');
    return null;
}

export const BatchUploadModal: React.FC<BatchUploadModalProps> = ({
    isOpen,
    onClose,
    medications,
    onSuccess
}) => {
    const [step, setStep] = useState<'select-med' | 'select-photos' | 'preview'>('select-med');
    const [selectedMedId, setSelectedMedId] = useState<string>('');
    const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [overallProgress, setOverallProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;

        const files = Array.from(e.target.files);
        const newItems: UploadItem[] = [];

        for (let file of files) {
            try {
                // ✅ 修复1：转换 HEIC 为 JPEG
                file = await normalizeImageFile(file);
                console.log('[UPLOAD_FILE]', {
                    name: file.name,
                    type: file.type,
                    size: file.size
                });

                // ✅ 使用统一的时间解析函数
                const resolved = await resolveTakenAt(file);

                // ✅ 验证时间是否有效
                if (!resolved || !resolved.date || isNaN(resolved.date.getTime())) {
                    throw new Error(`无法解析照片拍摄时间: ${file.name}`);
                }

                const { date: takenAt, source: timeSource } = resolved;

                // 🔴 诊断日志 1: 解析完成后立刻打印
                console.log('[BATCH] resolvedTakenAt', {
                    file: file.name,
                    type: file.type,
                    lastModified: file.lastModified,
                    resolvedTakenAt: takenAt.toISOString(),
                    source: timeSource
                });

                newItems.push({
                    file,
                    previewUrl: URL.createObjectURL(file),
                    takenAt,
                    timeSource,
                    selected: true,
                    status: 'pending',
                    uploadProgress: 0
                });
            } catch (err) {
                logger.error('处理文件失败', err);
                // ❌ 不创建 newItem，直接跳过该文件
                console.error('[BATCH_UPLOAD] 跳过文件:', file.name, err);
            }
        }

        setUploadItems(prev => [...prev, ...newItems]);
        setStep('preview');
    };

    const handleRemoveItem = (index: number) => {
        setUploadItems(prev => {
            const newItems = [...prev];
            URL.revokeObjectURL(newItems[index].previewUrl);
            newItems.splice(index, 1);
            return newItems;
        });
    };

    const handleTimeChange = (index: number, newTime: string) => {
        setUploadItems(prev => {
            const newItems = [...prev];
            const date = new Date(newItems[index].takenAt);
            const [hours, minutes] = newTime.split(':').map(Number);
            date.setHours(hours, minutes);
            newItems[index].takenAt = date;
            return newItems;
        });
    };

    const handleDateChange = (index: number, newDate: string) => {
        setUploadItems(prev => {
            const newItems = [...prev];
            const time = newItems[index].takenAt;
            const date = new Date(newDate);
            date.setHours(time.getHours(), time.getMinutes(), time.getSeconds());
            newItems[index].takenAt = date;
            return newItems;
        });
    };

    const handleSubmit = async () => {
        if (!selectedMedId || uploadItems.length === 0 || !supabase) return;

        const userId = await getCurrentUserId();
        if (!userId) {
            alert('用户未登录');
            return;
        }

        setIsSubmitting(true);
        setOverallProgress(0);

        const itemsToUpload = uploadItems.filter(item => item.selected && item.status !== 'success');
        let successCount = 0;

        for (let i = 0; i < itemsToUpload.length; i++) {
            const item = itemsToUpload[i];
            const itemIndex = uploadItems.findIndex(u => u.file === item.file);

            // 更新状态为上传中
            setUploadItems(prev => prev.map((p, idx) =>
                idx === itemIndex ? { ...p, status: 'uploading', uploadProgress: 0 } : p
            ));

            try {
                // 1. 生成文件路径
                const timestamp = Date.now();
                const fileExt = item.file.name.split('.').pop();
                const filePath = `${userId}/${selectedMedId}/${timestamp}_${Math.random().toString(36).slice(2)}.${fileExt}`;

                logger.log(`📤 上传图片 (${i + 1}/${itemsToUpload.length}): ${filePath}`);

                // 2. 上传图片（带重试）
                const uploadData = await retry(async () => {
                    const { data, error } = await supabase.storage
                        .from('medication-images')
                        .upload(filePath, item.file, {
                            cacheControl: '3600',
                            upsert: false,
                            contentType: item.file.type || 'image/jpeg'
                        });

                    if (error) {
                        throw new Error(`图片上传失败: ${error.message}`);
                    }

                    if (!data?.path) {
                        throw new Error('图片上传失败: 未返回路径');
                    }

                    return data;
                }, 2, 1000);  // 重试 2 次，间隔 1 秒

                console.log('[UPLOAD_SUCCESS]', {
                    path: uploadData.path,
                    type: item.file.type,
                    size: item.file.size
                });

                // 更新进度
                setUploadItems(prev => prev.map((p, idx) =>
                    idx === itemIndex ? { ...p, uploadProgress: 50 } : p
                ));

                // 3. 创建服药记录（只有 upload 成功才执行）
                // ✅ 上传前再次验证时间
                if (!item.takenAt || isNaN(item.takenAt.getTime())) {
                    throw new Error('时间解析失败，禁止创建补录记录');
                }

                const newLog: Partial<MedicationLog> = {
                    medication_id: selectedMedId,
                    taken_at: item.takenAt.toISOString(),
                    status: 'taken',
                    time_source: item.timeSource || 'batch_upload',
                    image_path: uploadData.path  // ✅ 使用返回的 path
                };

                console.log('[CREATE_LOG] taken_at:', item.takenAt.toISOString(), 'file:', item.file.name);

                // 🔴 诊断日志 2: 调用 addLogToCloud 前打印“最终 payload”
                console.log('[BATCH] addLog payload', {
                    medication_id: selectedMedId,
                    taken_at: item.takenAt.toISOString(),
                    time_source: item.timeSource || 'batch_upload',
                    image_path: uploadData.path
                });

                const result = await addLogToCloud(newLog);

                if (!result) {
                    throw new Error('创建记录失败');
                }

                // 成功
                setUploadItems(prev => prev.map((p, idx) =>
                    idx === itemIndex ? { ...p, status: 'success', uploadProgress: 100 } : p
                ));
                successCount++;

                logger.log(`✅ 上传成功 (${successCount}/${itemsToUpload.length}): ${item.file.name}`);

                // ✅ 每张图之间延迟 250ms，防止内存/CPU 过载
                if (i < itemsToUpload.length - 1) {
                    await new Promise(r => setTimeout(r, 250));
                }

            } catch (error: any) {
                console.error(`❌ 上传失败 (${i + 1}/${itemsToUpload.length}):`, error);
                setUploadItems(prev => prev.map((p, idx) =>
                    idx === itemIndex ? { ...p, status: 'error', errorMessage: error.message || '上传失败' } : p
                ));
            }

            // 更新总进度
            setOverallProgress(Math.round(((i + 1) / itemsToUpload.length) * 100));
        }

        setIsSubmitting(false);

        if (successCount === itemsToUpload.length) {
            setTimeout(() => {
                onSuccess();
                onClose();
                setUploadItems([]);
                setStep('select-med');
                setOverallProgress(0);
            }, 1000);
        } else {
            alert(`上传完成: ${successCount}/${itemsToUpload.length} 成功`);
        }
    };

    const selectedMed = medications.find(m => m.id === selectedMedId);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h3 className="text-lg font-black italic">📷 批量补录</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'select-med' && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-500 font-bold mb-2">请选择要补录的药品：</p>
                            <div className="grid grid-cols-1 gap-3">
                                {medications.map(med => (
                                    <button
                                        key={med.id}
                                        onClick={() => {
                                            setSelectedMedId(med.id);
                                            setStep('select-photos');
                                        }}
                                        className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all text-left group"
                                    >
                                        <div
                                            className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-sm group-hover:scale-110 transition-transform"
                                            style={{ backgroundColor: med.accent || '#e5e7eb', color: '#fff' }}
                                        >
                                            {med.name.slice(0, 1)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900">{med.name}</div>
                                            <div className="text-xs text-gray-400 font-medium">{med.dosage}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 'select-photos' && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-6">
                            <div
                                className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-100 transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="w-8 h-8 text-blue-500" />
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-gray-900">点击上传照片</p>
                                <p className="text-xs text-gray-400 mt-1">支持多选，自动识别拍摄时间</p>
                                <p className="text-xs text-gray-400">EXIF → 文件名 → 修改时间</p>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                multiple
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                            <button
                                onClick={() => setStep('select-med')}
                                className="text-xs text-gray-400 hover:text-gray-600 underline"
                            >
                                返回重选药品
                            </button>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                        style={{ backgroundColor: selectedMed?.accent || '#ccc' }}
                                    >
                                        {selectedMed?.name.slice(0, 1)}
                                    </div>
                                    <span className="font-bold text-sm">{selectedMed?.name}</span>
                                </div>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-xs text-blue-600 font-bold hover:underline"
                                >
                                    添加更多
                                </button>
                            </div>

                            {/* 总进度条 */}
                            {isSubmitting && (
                                <div className="bg-blue-50 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-blue-700">上传进度</span>
                                        <span className="text-xs font-bold text-blue-700">{overallProgress}%</span>
                                    </div>
                                    <div className="w-full bg-blue-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${overallProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                {uploadItems.map((item, index) => (
                                    <div key={index} className="flex gap-4 p-3 rounded-xl border border-gray-100 bg-white shadow-sm relative group">
                                        <img src={item.previewUrl} className="w-20 h-20 object-cover rounded-lg bg-gray-100" alt="preview" />

                                        {item.status === 'pending' && (
                                            <button
                                                onClick={() => handleRemoveItem(index)}
                                                className="absolute -top-2 -left-2 w-6 h-6 bg-red-100 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}

                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3 h-3 text-gray-400" />
                                                <input
                                                    type="date"
                                                    value={item.takenAt.toISOString().split('T')[0]}
                                                    onChange={(e) => handleDateChange(index, e.target.value)}
                                                    disabled={item.status !== 'pending'}
                                                    className="text-xs font-bold text-gray-700 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 outline-none w-24 disabled:opacity-50"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3 h-3 text-gray-400" />
                                                <input
                                                    type="time"
                                                    value={`${String(item.takenAt.getHours()).padStart(2, '0')}:${String(item.takenAt.getMinutes()).padStart(2, '0')}`}
                                                    onChange={(e) => handleTimeChange(index, e.target.value)}
                                                    disabled={item.status !== 'pending'}
                                                    className="text-xs font-bold text-gray-700 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 outline-none w-16 disabled:opacity-50"
                                                />
                                            </div>

                                            {item.status === 'uploading' && (
                                                <div className="flex items-center gap-2">
                                                    <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                                                    <span className="text-[10px] text-blue-500 font-bold">上传中 {item.uploadProgress}%</span>
                                                </div>
                                            )}
                                            {item.status === 'success' && (
                                                <span className="text-[10px] text-green-500 font-bold flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> 已上传
                                                </span>
                                            )}
                                            {item.status === 'error' && (
                                                <div className="flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3 text-red-500" />
                                                    <span className="text-[10px] text-red-500 font-bold">{item.errorMessage || '上传失败'}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === 'preview' && (
                    <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <span className="text-xs text-gray-400 font-bold">共 {uploadItems.length} 张图片</span>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || uploadItems.length === 0}
                            className="bg-blue-600 text-white px-6 py-2.5 rounded-full font-bold shadow-lg shadow-blue-200 hover:shadow-blue-300 active:scale-95 transition-all text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isSubmitting ? `上传中 ${overallProgress}%` : '确认补录'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
