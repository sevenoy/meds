// 存储服务 - 照片上传（Supabase Storage 或 Mock）

import { supabase, isMockMode } from '../lib/supabase';
import { fileToDataURL } from '../utils/crypto';

/**
 * 上传照片到 Supabase Storage
 */
export async function uploadImage(
  file: File,
  userId: string,
  medicationId: string
): Promise<string> {
  if (isMockMode) {
    // Mock 模式：返回 DataURL
    return await fileToDataURL(file);
  }
  
  const fileName = `${userId}/${medicationId}/${Date.now()}_${file.name}`;
  const { data, error } = await supabase!.storage
    .from('medication-images')
    .upload(fileName, file);
  
  if (error) throw error;
  
  // 获取公共 URL
  const { data: { publicUrl } } = supabase!.storage
    .from('medication-images')
    .getPublicUrl(fileName);
  
  return publicUrl;
}

/**
 * 删除照片
 */
export async function deleteImage(imagePath: string): Promise<void> {
  if (isMockMode) {
    // Mock 模式：无需删除
    return;
  }
  
  // 从 URL 中提取路径
  const path = imagePath.split('/storage/v1/object/public/medication-images/')[1];
  if (path) {
    await supabase!.storage
      .from('medication-images')
      .remove([path]);
  }
}



