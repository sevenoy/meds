-- Supabase 数据库架构修复脚本
-- 修复字段不匹配问题

-- 1. 添加 medications 表的 accent 字段
ALTER TABLE medications 
ADD COLUMN IF NOT EXISTS accent TEXT;

-- 2. 添加 medication_logs 表的 local_id 字段（可选，用于本地临时ID）
ALTER TABLE medication_logs 
ADD COLUMN IF NOT EXISTS local_id TEXT;

-- 3. 添加 sync_state 字段（用于同步状态）
ALTER TABLE medication_logs 
ADD COLUMN IF NOT EXISTS sync_state TEXT CHECK (sync_state IN ('clean', 'dirty', 'syncing', 'conflict'));

-- 4. 创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_medication_logs_local_id ON medication_logs(local_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_sync_state ON medication_logs(sync_state);

-- 5. 验证字段
DO $$
BEGIN
  -- 检查 medications 表
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'medications' AND column_name = 'accent'
  ) THEN
    RAISE EXCEPTION 'medications.accent 字段创建失败';
  END IF;
  
  -- 检查 medication_logs 表
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'medication_logs' AND column_name = 'local_id'
  ) THEN
    RAISE EXCEPTION 'medication_logs.local_id 字段创建失败';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'medication_logs' AND column_name = 'sync_state'
  ) THEN
    RAISE EXCEPTION 'medication_logs.sync_state 字段创建失败';
  END IF;
  
  RAISE NOTICE '✅ 所有字段已成功添加';
END $$;
