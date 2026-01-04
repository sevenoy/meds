import CryptoJS from 'crypto-js';

/**
 * 计算图片 SHA-256 哈希
 */
export function calculateImageHash(imageData: string): string {
  return CryptoJS.SHA256(imageData).toString();
}

/**
 * 验证图片完整性
 */
export function verifyImageIntegrity(imageData: string, hash: string): boolean {
  return calculateImageHash(imageData) === hash;
}

