-- ========================================
-- Meds 药盒助手 - 完整数据库迁移脚本
-- 一键执行所有必需的数据库设置
-- ========================================

-- ========================================
-- 第 1 部分：基础表结构
-- ========================================

-- 1. 药物定义表
CREATE TABLE IF NOT EXISTS medications (
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
CREATE TABLE IF NOT EXISTS medication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  
  -- 时间字段
  taken_at TIMESTAMPTZ NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 元数据
  time_source TEXT NOT NULL CHECK (time_source IN ('exif', 'system', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('ontime', 'late', 'manual', 'suspect')),
  
  -- 证据
  image_path TEXT,
  image_hash TEXT,
  
  -- 同步相关
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  source_device TEXT,
  device_id TEXT
);

-- 3. 用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}'::jsonb,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  device_id TEXT
);

-- 4. 快照表
CREATE TABLE IF NOT EXISTS snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  device_id TEXT,
  snapshot_type TEXT DEFAULT 'manual'
);

-- ========================================
-- 第 2 部分：索引
-- ========================================

CREATE INDEX IF NOT EXISTS idx_medications_user_id ON medications(user_id);
CREATE INDEX IF NOT EXISTS idx_medications_updated_at ON medications(updated_at);
CREATE INDEX IF NOT EXISTS idx_medication_logs_user_id ON medication_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_medication_id ON medication_logs(medication_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_taken_at ON medication_logs(taken_at);
CREATE INDEX IF NOT EXISTS idx_medication_logs_image_hash ON medication_logs(image_hash);
CREATE INDEX IF NOT EXISTS idx_medication_logs_updated_at ON medication_logs(updated_at);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_updated_at ON user_settings(updated_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_user_id ON snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON snapshots(created_at);

-- 唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS idx_medication_logs_unique_hash 
ON medication_logs(user_id, image_hash) 
WHERE image_hash IS NOT NULL;

-- ========================================
-- 第 3 部分：Row Level Security (RLS)
-- ========================================

-- 启用 RLS
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;

-- medications 表策略
DROP POLICY IF EXISTS "Users can view own medications" ON medications;
CREATE POLICY "Users can view own medications"
  ON medications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own medications" ON medications;
CREATE POLICY "Users can insert own medications"
  ON medications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own medications" ON medications;
CREATE POLICY "Users can update own medications"
  ON medications FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own medications" ON medications;
CREATE POLICY "Users can delete own medications"
  ON medications FOR DELETE
  USING (auth.uid() = user_id);

-- medication_logs 表策略
DROP POLICY IF EXISTS "Users can view own medication logs" ON medication_logs;
CREATE POLICY "Users can view own medication logs"
  ON medication_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own medication logs" ON medication_logs;
CREATE POLICY "Users can insert own medication logs"
  ON medication_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own medication logs" ON medication_logs;
CREATE POLICY "Users can update own medication logs"
  ON medication_logs FOR UPDATE
  USING (auth.uid() = user_id);

-- user_settings 表策略
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own settings" ON user_settings;
CREATE POLICY "Users can delete own settings"
  ON user_settings FOR DELETE
  USING (auth.uid() = user_id);

-- snapshots 表策略
DROP POLICY IF EXISTS "Users can view own snapshots" ON snapshots;
CREATE POLICY "Users can view own snapshots"
  ON snapshots FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own snapshots" ON snapshots;
CREATE POLICY "Users can insert own snapshots"
  ON snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own snapshots" ON snapshots;
CREATE POLICY "Users can delete own snapshots"
  ON snapshots FOR DELETE
  USING (auth.uid() = user_id);

-- ========================================
-- 第 4 部分：Storage Buckets
-- ========================================

-- 创建 avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 创建 medication-photos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('medication-photos', 'medication-photos', true)
ON CONFLICT (id) DO NOTHING;

-- avatars storage 策略
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload own avatar'
  ) THEN
    CREATE POLICY "Users can upload own avatar"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'avatars' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can update own avatar'
  ) THEN
    CREATE POLICY "Users can update own avatar"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'avatars' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete own avatar'
  ) THEN
    CREATE POLICY "Users can delete own avatar"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'avatars' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Anyone can view avatars'
  ) THEN
    CREATE POLICY "Anyone can view avatars"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'avatars');
  END IF;
END $$;

-- medication-photos storage 策略
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload own photos'
  ) THEN
    CREATE POLICY "Users can upload own photos"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'medication-photos' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can update own photos'
  ) THEN
    CREATE POLICY "Users can update own photos"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'medication-photos' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete own photos'
  ) THEN
    CREATE POLICY "Users can delete own photos"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'medication-photos' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can view own photos'
  ) THEN
    CREATE POLICY "Users can view own photos"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'medication-photos' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- ========================================
-- 完成！
-- ========================================

-- 验证表是否创建成功
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

