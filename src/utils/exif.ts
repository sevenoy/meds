// EXIF 时间提取工具 - 核心功能

import exifr from 'exifr';
import type { ExifResult, TimeSource } from '../types';

/**
 * 提取照片的真实拍摄时间
 * 使用 exifr 库，支持 HEIC/HEIF、JPEG、PNG 等多种格式
 * 优先级: DateTimeOriginal > CreateDate > 当前时间（用于截图等无EXIF情况）
 */
export async function extractTakenAt(file: File): Promise<ExifResult> {
  try {
    // 使用 exifr 解析 EXIF 数据（支持 HEIC/HEIF）
    const exifData = await exifr.parse(file, {
      pick: ['DateTimeOriginal', 'CreateDate', 'DateTimeDigitized', 'ModifyDate']
    });

    // 获取拍摄时间（优先级顺序）
    const takenAt = exifData?.DateTimeOriginal || 
                    exifData?.CreateDate || 
                    exifData?.DateTimeDigitized;

    if (takenAt && takenAt instanceof Date) {
      // 检查 EXIF 时间是否合理（在过去 24 小时内）
      const now = new Date();
      const hoursDiff = (now.getTime() - takenAt.getTime()) / (1000 * 60 * 60);

      // 如果 EXIF 时间超过 24 小时前，可能是旧照片，使用当前时间
      if (hoursDiff > 24) {
        return {
          takenAt: new Date(),
          source: 'system'
        };
      }

      return {
        takenAt: takenAt,
        source: 'exif'
      };
    }

    // 没有 EXIF 时间，使用当前时间
    return {
      takenAt: new Date(),
      source: 'system'
    };
  } catch (error) {
    console.error('EXIF 解析失败:', error);
    // 解析失败，使用当前时间
    return {
      takenAt: new Date(),
      source: 'system'
    };
  }
}

/**
 * 计算时间可信度状态
 */
export function calculateStatus(
  takenAt: Date,
  uploadedAt: Date
): 'ontime' | 'late' | 'manual' | 'suspect' {
  const delta = Math.abs(uploadedAt.getTime() - takenAt.getTime());
  const oneHour = 60 * 60 * 1000;
  const sixHours = 6 * 60 * 60 * 1000;

  if (delta < oneHour) {
    return 'ontime';
  } else if (delta < sixHours) {
    return 'late';
  } else {
    return 'suspect';
  }
}

