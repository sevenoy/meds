// 药物服务 - 业务逻辑层

import { extractTakenAt, calculateStatus } from '../utils/exif';
import { calculateImageHash } from '../utils/crypto';
import { uploadImage } from './storage';
import { addMedicationLog, getMedicationLogs, getMedications, getDeviceId } from '../db/localDB';
import { getCurrentUserId } from '../lib/supabase';
import { pushLocalChanges } from './sync';
import type { Medication, MedicationLog, TimeSource } from '../types';

/**
 * 记录服药（核心功能）
 */
export async function recordMedicationIntake(
  medicationId: string,
  imageFile: File,
  customTakenAt?: Date // 新增：允许自定义服药时间
): Promise<MedicationLog> {
  const userId = await getCurrentUserId();
  const deviceId = getDeviceId();
  const uploadedAt = new Date();
  
  let takenAtDate: Date;
  let source: TimeSource;
  
  if (customTakenAt) {
    // 使用用户确认的时间
    takenAtDate = customTakenAt;
    // 尝试提取 EXIF 以确定时间来源
    const exifResult = await extractTakenAt(imageFile);
    source = exifResult.source;
  } else {
    // 1. 提取 EXIF 时间
    const exifResult = await extractTakenAt(imageFile);
    takenAtDate = exifResult.takenAt || uploadedAt;
    source = exifResult.source;
  }
  
  // 2. 计算状态
  const status = calculateStatus(takenAtDate, uploadedAt);
  
  // 3. 计算图片哈希
  const imageHash = await calculateImageHash(imageFile);
  
  // 4. 上传图片
  console.log('📸 开始上传图片...', { userId, medicationId, fileName: imageFile.name });
  const imagePath = await uploadImage(imageFile, userId!, medicationId);
  console.log('✅ 图片上传成功，路径:', imagePath?.substring(0, 100) + '...');
  
  // 5. 创建记录
  const log: MedicationLog = {
    id: '', // 将由 addMedicationLog 生成
    medication_id: medicationId,
    user_id: userId || undefined,
    taken_at: takenAtDate.toISOString(),
    uploaded_at: uploadedAt.toISOString(),
    time_source: source,
    status,
    image_path: imagePath, // 确保 image_path 被正确设置
    image_hash: imageHash,
    source_device: deviceId,
    sync_state: 'dirty'
  };
  
  console.log('📝 创建记录:', {
    id: log.id,
    medication_id: log.medication_id,
    image_path: log.image_path ? log.image_path.substring(0, 50) + '...' : 'null',
    image_hash: log.image_hash?.substring(0, 20) + '...'
  });
  
  // 6. 保存到本地数据库
  const savedId = await addMedicationLog(log);
  console.log('💾 记录已保存到本地数据库，ID:', savedId);
  
  // 验证保存的数据
  const savedLog = await getMedicationLogs(medicationId);
  const justSaved = savedLog.find(l => l.id === savedId);
  if (justSaved) {
    console.log('✅ 验证保存的数据:', {
      id: justSaved.id,
      has_image_path: !!justSaved.image_path,
      image_path_length: justSaved.image_path?.length || 0
    });
  } else {
    console.warn('⚠️ 保存的记录未找到，可能有问题');
  }
  
  // 7. 尝试同步（后台）
  pushLocalChanges().catch(console.error);
  
  return log;
}

/**
 * 获取今日药物列表（带状态）
 */
export async function getTodayMedications(): Promise<Medication[]> {
  return await getMedications();
}

/**
 * 获取药物的历史记录
 */
export async function getMedicationHistory(medicationId: string): Promise<MedicationLog[]> {
  return await getMedicationLogs(medicationId);
}

/**
 * 判断药物今日是否已服用
 */
export async function isMedicationTakenToday(medicationId: string): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const logs = await getMedicationLogs(medicationId);
  return logs.some(log => {
    const takenAt = new Date(log.taken_at);
    return takenAt >= today && takenAt < tomorrow;
  });
}

