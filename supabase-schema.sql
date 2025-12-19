-- Supabase 数据库架构
-- 基于技术白皮书 v1.0

-- 1. 药物定义表
CREATE TABLE IF NOT EXISTS medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  scheduled_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 药物记录表（证据表 - 不可变）
CREATE TABLE IF NOT EXISTS medication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  
  -- 时间字段（核心）
  taken_at TIMESTAMPTZ NOT NULL,        -- EXIF 或降级时间
  uploaded_at TIMESTAMPTZ NOT NULL,    -- 前端上传时间
  created_at TIMESTAMPTZ DEFAULT NOW(), -- DB 写入时间
  
  -- 元数据
  time_source TEXT NOT NULL CHECK (time_source IN ('exif', 'system', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('ontime', 'late', 'manual', 'suspect')),
  
  -- 证据
  image_path TEXT,
  image_hash TEXT,                      -- SHA-256，用于防重复/篡改
  
  -- 同步相关
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  source_device TEXT
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_medications_user_id ON medications(user_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_user_id ON medication_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_medication_id ON medication_logs(medication_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_taken_at ON medication_logs(taken_at);
CREATE INDEX IF NOT EXISTS idx_medication_logs_image_hash ON medication_logs(image_hash);

-- 唯一约束：防止重复上传（相同哈希）
CREATE UNIQUE INDEX IF NOT EXISTS idx_medication_logs_unique_hash 
ON medication_logs(user_id, image_hash) 
WHERE image_hash IS NOT NULL;

-- RLS（行级安全）
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能访问自己的数据
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

CREATE POLICY "Users can view own medication logs"
  ON medication_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own medication logs"
  ON medication_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own medication logs"
  ON medication_logs FOR UPDATE
  USING (auth.uid() = user_id);

-- Storage Bucket（照片存储）
-- 需要在 Supabase Dashboard 中手动创建，或使用以下 SQL：
-- INSERT INTO storage.buckets (id, name, public) VALUES ('medication-images', 'medication-images', true);

-- Storage 策略
-- CREATE POLICY "Users can upload own images"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'medication-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can view own images"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'medication-images' AND auth.uid()::text = (storage.foldername(name))[1]);



