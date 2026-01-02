-- ========================================
-- Meds 药盒助手 - 完全重置数据库
-- 警告：会删除所有现有数据！
-- ========================================

-- ========================================
-- 第 0 部分：删除旧表（如果存在）
-- ========================================

DROP TABLE IF EXISTS snapshots CASCADE;
DROP TABLE IF EXISTS medication_logs CASCADE;
DROP TABLE IF EXISTS medications CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;

-- ========================================
-- 第 1 部分：创建表
-- ========================================

-- 1. 药物定义表
CREATE TABLE medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  scheduled_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  device_id TEXT,
  frequency TEXT DEFAULT 'daily'
);

-- 2. 药物记录表
CREATE TABLE medication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  taken_at TIMESTAMPTZ NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  time_source TEXT NOT NULL CHECK (time_source IN ('exif', 'system', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('ontime', 'late', 'manual', 'suspect')),
  image_path TEXT,
  image_hash TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  source_device TEXT,
  device_id TEXT
);

-- 3. 用户设置表
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}'::jsonb,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  device_id TEXT
);

-- 4. 快照表
CREATE TABLE snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  device_id TEXT,
  snapshot_type TEXT DEFAULT 'manual'
);

-- ========================================
-- 第 2 部分：创建索引
-- ========================================

CREATE INDEX idx_medications_user_id ON medications(user_id);
CREATE INDEX idx_medications_updated_at ON medications(updated_at);
CREATE INDEX idx_medication_logs_user_id ON medication_logs(user_id);
CREATE INDEX idx_medication_logs_medication_id ON medication_logs(medication_id);
CREATE INDEX idx_medication_logs_taken_at ON medication_logs(taken_at);
CREATE INDEX idx_medication_logs_updated_at ON medication_logs(updated_at);
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX idx_user_settings_updated_at ON user_settings(updated_at);
CREATE INDEX idx_snapshots_user_id ON snapshots(user_id);

-- ========================================
-- 第 3 部分：启用 Row Level Security
-- ========================================

ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 第 4 部分：创建 RLS 策略
-- ========================================

-- medications 表策略
CREATE POLICY "Users can view own medications"
  ON medications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own medications"
  ON medications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own medications"
  ON medications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own medications"
  ON medications FOR DELETE
  USING (auth.uid() = user_id);

-- medication_logs 表策略
CREATE POLICY "Users can view own medication logs"
  ON medication_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own medication logs"
  ON medication_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own medication logs"
  ON medication_logs FOR UPDATE
  USING (auth.uid() = user_id);

-- user_settings 表策略
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
  ON user_settings FOR DELETE
  USING (auth.uid() = user_id);

-- snapshots 表策略
CREATE POLICY "Users can view own snapshots"
  ON snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snapshots"
  ON snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own snapshots"
  ON snapshots FOR DELETE
  USING (auth.uid() = user_id);

-- ========================================
-- 第 5 部分：创建 Storage Buckets
-- ========================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('medication-photos', 'medication-photos', true)
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- 完成！验证表是否创建成功
-- ========================================

SELECT 
  'medications' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'medications' AND table_schema = 'public'
UNION ALL
SELECT 
  'medication_logs',
  COUNT(*)
FROM information_schema.columns
WHERE table_name = 'medication_logs' AND table_schema = 'public'
UNION ALL
SELECT 
  'user_settings',
  COUNT(*)
FROM information_schema.columns
WHERE table_name = 'user_settings' AND table_schema = 'public'
UNION ALL
SELECT 
  'snapshots',
  COUNT(*)
FROM information_schema.columns
WHERE table_name = 'snapshots' AND table_schema = 'public';

