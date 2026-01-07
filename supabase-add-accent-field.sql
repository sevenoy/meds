-- 添加 accent 字段到 medications 表（用于颜色主题同步）
-- 执行日期: 2026-01-07

-- 添加 accent 字段（TEXT 类型，存储颜色值，如 '#E0F3A2' 或 'lime'）
ALTER TABLE medications 
ADD COLUMN IF NOT EXISTS accent TEXT;

-- 添加注释
COMMENT ON COLUMN medications.accent IS '药品颜色主题（hex 颜色值或预设值：lime/berry/mint）';

-- 确保 updated_at 字段存在（如果不存在则添加）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'medications' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE medications ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 确保 medication_logs.updated_at 字段存在（如果不存在则添加）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'medication_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE medication_logs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 可选：为现有药品设置默认颜色
UPDATE medications 
SET accent = '#E0F3A2' 
WHERE accent IS NULL;

