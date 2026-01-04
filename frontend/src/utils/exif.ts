import EXIF from 'exif-js';
import type { TimeSource } from '../../shared/types';

export interface ExifResult {
  takenAt: Date | null;
  source: TimeSource;
}

/**
 * 从图片中提取 EXIF 时间
 */
export function extractExifTime(file: File): Promise<ExifResult> {
  return new Promise((resolve) => {
    EXIF.getData(file as any, function() {
      const exifData = EXIF.getAllTags(this);
      
      // 尝试获取拍摄时间
      const dateTime = exifData.DateTimeOriginal || exifData.DateTime;
      
      if (dateTime) {
        // EXIF 日期格式: "YYYY:MM:DD HH:mm:ss"
        const [datePart, timePart] = dateTime.split(' ');
        const [year, month, day] = datePart.split(':');
        const [hour, minute, second] = timePart.split(':');
        
        const takenAt = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second)
        );
        
        resolve({
          takenAt,
          source: 'exif'
        });
      } else {
        // 降级到系统时间
        resolve({
          takenAt: new Date(),
          source: 'system'
        });
      }
    });
  });
}

/**
 * 计算图片哈希
 */
export function calculateImageHash(imageData: string): string {
  // 使用简单的哈希算法（生产环境应使用 crypto-js SHA-256）
  let hash = 0;
  for (let i = 0; i < imageData.length; i++) {
    const char = imageData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

