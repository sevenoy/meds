// 加密工具 - 用于照片完整性验证

import CryptoJS from 'crypto-js';
import heic2any from 'heic2any';

/**
 * 计算文件的 SHA-256 哈希值
 * 用于防重复上传和完整性验证
 */
export async function calculateImageHash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
        const hash = CryptoJS.SHA256(wordArray).toString();
        resolve(hash);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 将文件转换为 DataURL（用于 Mock 模式）
 * 如果是 HEIC/HEIF 格式，会先转换为 JPEG
 */
export async function fileToDataURL(file: File): Promise<string> {
  // 检查是否为 HEIC/HEIF 格式（需要转换）
  const isHEIC = file.type === 'image/heic' || 
                 file.type === 'image/heif' ||
                 file.name.toLowerCase().endsWith('.heic') ||
                 file.name.toLowerCase().endsWith('.heif');
  
  if (isHEIC) {
    // HEIC 需要转换为 JPEG 才能在浏览器中显示
    return await convertHEICToJPEG(file);
  }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 将 HEIC/HEIF 转换为 JPEG 格式的 DataURL
 * 使用 heic2any 库进行转换
 */
async function convertHEICToJPEG(file: File): Promise<string> {
  try {
    // 使用 heic2any 库将 HEIC 转换为 JPEG Blob
    const jpegBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9
    }) as Blob;
    
    // 将 Blob 转换为 DataURL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(jpegBlob);
    });
  } catch (error) {
    console.error('HEIC 转换失败，尝试直接读取:', error);
    // 回退：直接读取原始文件
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}



