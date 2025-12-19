// 核心类型定义 - 基于技术白皮书

export type TimeSource = 'exif' | 'system' | 'manual';
export type LogStatus = 'ontime' | 'late' | 'manual' | 'suspect';
export type SyncState = 'clean' | 'dirty' | 'syncing' | 'conflict';

// 药物定义
export interface Medication {
  id: string;
  user_id?: string;
  name: string;
  dosage: string;
  scheduled_time: string; // HH:mm 格式
  created_at?: string;
  accent?: 'berry' | 'lime' | 'mint';
}

// 药物记录（证据表 - 不可变）
export interface MedicationLog {
  id: string;
  user_id?: string;
  medication_id: string;
  
  // 时间字段（核心）
  taken_at: string;        // EXIF 或降级时间 (ISO 8601)
  uploaded_at: string;    // 前端上传时间 (ISO 8601)
  created_at?: string;     // DB 写入时间 (ISO 8601)
  
  // 元数据
  time_source: TimeSource; // exif / system / manual
  status: LogStatus;       // ontime / late / manual / suspect
  
  // 证据
  image_path?: string;     // Supabase Storage 路径或 DataURL
  image_hash?: string;      // SHA-256，用于防重复/篡改
  
  // 同步相关
  updated_at?: string;
  updated_by?: string;
  source_device?: string;
  
  // 本地字段
  sync_state?: SyncState;
  local_id?: string;       // 本地临时ID（未同步前）
}

// UI 状态（用于展示）
export interface MedicationUI extends Medication {
  status: 'pending' | 'completed' | 'overdue';
  lastTakenAt?: string;
  uploadedAt?: string;
}

// EXIF 解析结果
export interface ExifResult {
  takenAt: Date | null;
  source: TimeSource;
}

// 同步事件
export interface SyncEvent {
  type: 'insert' | 'update' | 'delete';
  log: MedicationLog;
  device: string;
  timestamp: string;
}

// 冲突信息
export interface ConflictInfo {
  local: MedicationLog;
  remote: MedicationLog;
  reason: string;
}



