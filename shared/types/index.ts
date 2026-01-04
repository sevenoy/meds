/**
 * 共享类型定义
 * 前后端共用
 */

// 药品接口
export interface Medication {
  id: string;
  user_id?: string;
  name: string;
  dosage: string;
  scheduled_time: string; // HH:mm 格式
  created_at?: string;
  updated_at?: string;
  accent?: string; // 颜色主题
  device_id?: string; // 设备标识
}

// 时间来源
export type TimeSource = 'exif' | 'system' | 'manual';

// 服药状态
export type LogStatus = 'ontime' | 'late' | 'manual' | 'suspect';

// 同步状态
export type SyncState = 'clean' | 'dirty' | 'syncing' | 'conflict';

// 服药记录
export interface MedicationLog {
  id: string;
  medication_id: string;
  user_id?: string;
  taken_at: string; // ISO 8601
  uploaded_at: string;
  time_source: TimeSource;
  status: LogStatus;
  image_path?: string;
  image_hash?: string;
  source_device?: string;
  sync_state?: SyncState;
  created_at?: string;
  updated_at?: string;
}

// 用户设置
export interface UserSettings {
  user_id: string;
  settings: {
    theme?: string;
    notifications?: boolean;
    upload_photos?: boolean;
    [key: string]: any;
  };
  created_at?: string;
  updated_at?: string;
}

// 快照载荷
export interface SnapshotPayload {
  medications: Medication[];
  medicationLogs: MedicationLog[];
  userSettings: UserSettings;
  version: number;
  timestamp: string;
}

// API 响应
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 冲突信息
export interface ConflictInfo {
  local: MedicationLog;
  remote: MedicationLog;
  reason: string;
}

