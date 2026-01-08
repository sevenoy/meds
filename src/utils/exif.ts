import { logger } from './logger';
import { logger } from './logger';
import { logger } from './logger';
import { logger } from './logger';
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
    logger.log('开始提取 EXIF 数据:', file.name, file.type);
    
    // 使用 exifr 解析 EXIF 数据（支持 HEIC/HEIF）
    const exifData = await exifr.parse(file, {
      pick: ['DateTimeOriginal', 'CreateDate', 'DateTimeDigitized', 'DateTime', 'ModifyDate'],
      // 确保支持所有格式
      tiff: true,
      xmp: true,
      icc: false,
      iptc: false,
      jfif: false,
      ihdr: false
    });

    logger.log('EXIF 数据:', exifData);

    // 获取拍摄时间（优先级顺序）
    const takenAt = exifData?.DateTimeOriginal || 
                    exifData?.CreateDate || 
                    exifData?.DateTimeDigitized ||
                    exifData?.DateTime;

    logger.log('提取的拍摄时间:', takenAt);

    if (takenAt && takenAt instanceof Date) {
      // 验证时间是否有效（不是未来时间，不早于2000年）
      const now = new Date();
      const minDate = new Date('2000-01-01');
      
      if (takenAt > now) {
        logger.warn('照片时间在未来，使用当前时间');
        return {
          takenAt: new Date(),
          source: 'system'
        };
      }
      
      if (takenAt < minDate) {
        logger.warn('照片时间过早，使用当前时间');
        return {
          takenAt: new Date(),
          source: 'system'
        };
      }

      logger.log('使用 EXIF 时间:', takenAt);
      return {
        takenAt: takenAt,
        source: 'exif'
      };
    }

    // 没有 EXIF 时间，使用当前时间
    logger.warn('未找到有效的 EXIF 时间，使用系统时间');
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

