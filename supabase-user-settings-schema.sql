-- 用户设置表
-- 用于存储用户的个人配置，支持多设备同步

-- 创建用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 设置内容（JSON格式，灵活存储各种配置）
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 确保每个用户只有一条设置记录
  UNIQUE(user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_updated_at ON user_settings(updated_at);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_settings_updated_at ON user_settings;
CREATE TRIGGER trigger_update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();

-- Row Level Security (RLS) 策略
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的设置
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能插入自己的设置
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的设置
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- 用户可以删除自己的设置
DROP POLICY IF EXISTS "Users can delete own settings" ON user_settings;
CREATE POLICY "Users can delete own settings"
  ON user_settings FOR DELETE
  USING (auth.uid() = user_id);

-- 示例设置数据结构
COMMENT ON TABLE user_settings IS '用户个人设置表，支持多设备同步';
COMMENT ON COLUMN user_settings.settings IS '用户设置JSON: {theme, notifications, language, etc}';

-- 示例：插入默认设置
-- INSERT INTO user_settings (user_id, settings) VALUES
-- (auth.uid(), '{
--   "theme": "light",
--   "notifications": true,
--   "language": "zh-CN",
--   "calendar": {
--     "showWeekends": true,
--     "startOfWeek": 1
--   }
-- }'::jsonb);
