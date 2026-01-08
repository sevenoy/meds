import { logger } from '../utils/logger';
import { logger } from '../utils/logger';
import { logger } from '../utils/logger';
import { logger } from '../utils/logger';
// 存储服务 - 照片上传到 Supabase Storage

import { supabase } from '../lib/supabase';
import { fileToDataURL } from '../utils/crypto';

/**
 * 上传照片到 Supabase Storage
 * 【修复 B】禁止 DataURL 降级：bucket 不存在时直接停止图片写入
 */
export async function uploadImage(
  file: File,
  userId: string,
  medicationId: string
): Promise<string> {
  const fileName = `${userId}/${medicationId}/${Date.now()}_${file.name}`;
  const { data, error } = await supabase!.storage
    .from('medication-images')
    .upload(fileName, file);
  
  if (error) {
    // 【修复 B】检查是否是 bucket 不存在的错误
    if (error.message?.includes('Bucket not found') || 
        error.message?.includes('not found') ||
        error.statusCode === 400) {
      const errorMsg = 'Storage bucket medication-images 不存在，请先创建 bucket';
      console.error('❌', errorMsg);
      // 【修复 B】不允许 fallback 到 data:image/...，直接抛出错误
      throw new Error(errorMsg);
    }
    // 其他错误直接抛出
    throw error;
  }
  
  // 获取公共 URL
  const { data: { publicUrl } } = supabase!.storage
    .from('medication-images')
    .getPublicUrl(fileName);
  
  logger.log('✅ 图片已上传到 Supabase Storage:', publicUrl);
  return publicUrl;
}

/**
 * 检查 Storage bucket 是否存在
 */
export async function checkStorageBucket(): Promise<boolean> {
  try {
    // 尝试列出 bucket（即使为空也会成功）
    const { data, error } = await supabase.storage
      .from('medication-images')
      .list('', { limit: 1 });
    
    if (error) {
      if (error.message?.includes('Bucket not found') || error.message?.includes('not found')) {
        console.error('❌ Storage bucket "medication-images" 不存在');
        return false;
      }
      throw error;
    }
    
    logger.log('✅ Storage bucket "medication-images" 可用');
    return true;
  } catch (error: any) {
    console.error('❌ 检查 Storage bucket 失败:', error);
    return false;
  }
}

/**
 * 删除照片
 */
export async function deleteImage(imagePath: string): Promise<void> {
  // 如果是 DataURL，无需删除
  if (imagePath.startsWith('data:')) {
    return;
  }
  
  // 从 URL 中提取路径
  const path = imagePath.split('/storage/v1/object/public/medication-images/')[1];
  if (path) {
    await supabase.storage
      .from('medication-images')
      .remove([path]);
  }
}




