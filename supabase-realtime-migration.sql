-- Supabase Realtime 多设备同步数据库迁移
-- 确保所有表都有必要的字段和触发器

-- ============================================
-- 1. 添加必要的字段
-- ============================================

-- medications 表添加 updated_at 和 user_id 字段（如果不存在）
DO $$ 
BEGIN
    -- 添加 updated_at 字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'medications' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE medications ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- 添加 user_id 字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'medications' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE medications ADD COLUMN user_id TEXT;
    END IF;
END $$;

-- medication_logs 表添加 updated_at 和 user_id 字段（如果不存在）
DO $$ 
BEGIN
    -- 添加 updated_at 字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'medication_logs' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE medication_logs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- 添加 user_id 字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'medication_logs' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE medication_logs ADD COLUMN user_id TEXT;
    END IF;
END $$;

-- user_settings 表添加 updated_at 字段（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_settings' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE user_settings ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- ============================================
-- 2. 创建自动更新 updated_at 的触发器函数
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. 为各表创建触发器
-- ============================================

-- medications 表触发器
DROP TRIGGER IF EXISTS medications_updated_at ON medications;
CREATE TRIGGER medications_updated_at
    BEFORE UPDATE ON medications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- medication_logs 表触发器
DROP TRIGGER IF EXISTS medication_logs_updated_at ON medication_logs;
CREATE TRIGGER medication_logs_updated_at
    BEFORE UPDATE ON medication_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- user_settings 表触发器
DROP TRIGGER IF EXISTS user_settings_updated_at ON user_settings;
CREATE TRIGGER user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. 创建索引以优化 Realtime 查询性能
-- ============================================

-- medications 表索引
CREATE INDEX IF NOT EXISTS idx_medications_user_id ON medications(user_id);
CREATE INDEX IF NOT EXISTS idx_medications_updated_at ON medications(updated_at DESC);

-- medication_logs 表索引
CREATE INDEX IF NOT EXISTS idx_medication_logs_user_id ON medication_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_updated_at ON medication_logs(updated_at DESC);

-- user_settings 表索引
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_updated_at ON user_settings(updated_at DESC);

-- ============================================
-- 5. 启用 Row Level Security (可选但推荐)
-- ============================================

-- 启用 RLS
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 创建策略：用户只能访问自己的数据
-- 注意：这里假设使用 user_id 字段进行过滤
-- 如果使用 Supabase Auth，可以使用 auth.uid()

-- medications 表策略
DROP POLICY IF EXISTS "Users can access their own medications" ON medications;
CREATE POLICY "Users can access their own medications"
    ON medications
    FOR ALL
    USING (user_id = current_user OR user_id IS NULL);

-- medication_logs 表策略
DROP POLICY IF EXISTS "Users can access their own logs" ON medication_logs;
CREATE POLICY "Users can access their own logs"
    ON medication_logs
    FOR ALL
    USING (user_id = current_user OR user_id IS NULL);

-- user_settings 表策略
DROP POLICY IF EXISTS "Users can access their own settings" ON user_settings;
CREATE POLICY "Users can access their own settings"
    ON user_settings
    FOR ALL
    USING (user_id = current_user OR user_id IS NULL);

-- ============================================
-- 6. 验证迁移
-- ============================================

-- 检查字段是否存在
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name IN ('medications', 'medication_logs', 'user_settings')
    AND column_name IN ('updated_at', 'user_id')
ORDER BY table_name, column_name;

-- 检查触发器是否创建
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%updated_at%';

-- 检查索引是否创建
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE tablename IN ('medications', 'medication_logs', 'user_settings')
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ============================================
-- 完成提示
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Realtime 多设备同步迁移完成！';
    RAISE NOTICE '📋 下一步：';
    RAISE NOTICE '1. 在 Supabase Dashboard → Database → Replication 中启用表的 Realtime';
    RAISE NOTICE '2. 启用以下表：medications, medication_logs, user_settings';
    RAISE NOTICE '3. 重启应用以测试多设备同步功能';
END $$;

