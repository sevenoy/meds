// 存储服务 - 照片上传（Supabase Storage 或 Mock）

import { supabase, isMockMode } from '../lib/supabase';
import { fileToDataURL } from '../utils/crypto';

/**
 * 上传照片到 Supabase Storage
 * 如果 Storage bucket 不存在，自动降级到 DataURL（本地存储）
 */
export async function uploadImage(
  file: File,
  userId: string,
  medicationId: string
): Promise<string> {
  if (isMockMode) {
    // Mock 模式：返回 DataURL
    console.log('🔧 Mock模式：使用DataURL存储图片');
    return await fileToDataURL(file);
  }
  
  try {
    const fileName = `${userId}/${medicationId}/${Date.now()}_${file.name}`;
    const { data, error } = await supabase!.storage
      .from('medication-images')
      .upload(fileName, file);
    
    if (error) {
      // 检查是否是 bucket 不存在的错误
      if (error.message?.includes('Bucket not found') || error.message?.includes('not found')) {
        console.warn('⚠️ Storage bucket 不存在，自动降级到 DataURL 模式');
        console.warn('💡 提示：请在 Supabase Dashboard 中创建 medication-images bucket');
        // 自动降级到 DataURL
        return await fileToDataURL(file);
      }
      // 其他错误直接抛出
      throw error;
    }
    
    // 获取公共 URL
    const { data: { publicUrl } } = supabase!.storage
      .from('medication-images')
      .getPublicUrl(fileName);
    
    console.log('✅ 图片已上传到 Supabase Storage:', publicUrl);
    return publicUrl;
  } catch (error: any) {
    // 捕获所有错误，自动降级到 DataURL
    console.error('❌ 上传图片失败，自动降级到 DataURL:', error);
    console.warn('💡 提示：图片将保存在本地，不会同步到云端');
    
    // 显示用户友好的提示
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 z-50 bg-orange-500 text-white px-6 py-3 rounded-full font-bold text-sm shadow-lg animate-fade-in';
    notification.textContent = '⚠️ 云端存储不可用，图片已保存到本地';
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.classList.add('animate-fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
    
    // 降级到 DataURL
    return await fileToDataURL(file);
  }
}

/**
 * 检查 Storage bucket 是否存在
 */
export async function checkStorageBucket(): Promise<boolean> {
  if (isMockMode || !supabase) {
    return false;
  }
  
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
    
    console.log('✅ Storage bucket "medication-images" 可用');
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




