-- ============================================
-- Phase 1: 创建 app_state 快照表
-- 用于多设备实时同步（cloudSaveV2 / cloudLoadV2）
-- ============================================

-- 1. 创建 app_state 表
CREATE TABLE IF NOT EXISTS app_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

-- 2. 创建索引（优化查询性能）
CREATE INDEX IF NOT EXISTS idx_app_state_owner_id ON app_state(owner_id);
CREATE INDEX IF NOT EXISTS idx_app_state_updated_at ON app_state(updated_at DESC);

-- 3. 启用 Row Level Security (RLS)
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

-- 4. 创建 RLS 策略

-- SELECT 策略：用户只能查看自己的数据
CREATE POLICY "Users can view own app_state"
  ON app_state
  FOR SELECT
  USING (auth.uid() = owner_id);

-- INSERT 策略：用户只能插入自己的数据
CREATE POLICY "Users can insert own app_state"
  ON app_state
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- UPDATE 策略：用户只能更新自己的数据
CREATE POLICY "Users can update own app_state"
  ON app_state
  FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- 5. 启用 Realtime（用于多设备实时同步）
ALTER PUBLICATION supabase_realtime ADD TABLE app_state;

-- 完成
-- 表结构：
-- - id: UUID (主键，自动生成)
-- - owner_id: UUID (外键，关联 auth.users)
-- - payload: JSONB (应用状态数据)
-- - version: INT (版本号，默认 1)
-- - updated_at: TIMESTAMPTZ (更新时间，自动更新)
-- - updated_by: TEXT (更新者名称，可选)
