-- 药盒助手云端快照管理表
-- 基于云端同步技术文档设计

-- 1. 创建快照表
CREATE TABLE IF NOT EXISTS app_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL,                           -- 快照键（如 "default"）
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- 所有者用户ID
  payload JSONB NOT NULL,                      -- 数据负载
  updated_at TIMESTAMPTZ DEFAULT NOW(),        -- 更新时间戳（服务器端）
  updated_by_name TEXT,                        -- 更新者用户名
  created_at TIMESTAMPTZ DEFAULT NOW(),        -- 创建时间
  
  -- 唯一约束：每个用户的每个key只有一个快照
  CONSTRAINT app_snapshots_key_owner_unique UNIQUE (key, owner_id)
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_app_snapshots_owner_id ON app_snapshots(owner_id);
CREATE INDEX IF NOT EXISTS idx_app_snapshots_key ON app_snapshots(key);
CREATE INDEX IF NOT EXISTS idx_app_snapshots_updated_at ON app_snapshots(updated_at DESC);

-- 3. 启用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE app_snapshots;

-- 4. 启用 Row Level Security (RLS)
ALTER TABLE app_snapshots ENABLE ROW LEVEL SECURITY;

-- 5. 创建 RLS 策略
-- 用户只能管理自己的快照
CREATE POLICY "Users can manage own snapshots" ON app_snapshots
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- 6. 添加注释
COMMENT ON TABLE app_snapshots IS '药盒助手云端快照管理表';
COMMENT ON COLUMN app_snapshots.key IS '快照键，默认使用 "default"';
COMMENT ON COLUMN app_snapshots.owner_id IS '快照所有者的用户ID';
COMMENT ON COLUMN app_snapshots.payload IS 'JSON数据，包含 medications, medication_logs, user_settings, snapshot_label';
COMMENT ON COLUMN app_snapshots.updated_at IS '快照更新时间（服务器时间戳）';
COMMENT ON COLUMN app_snapshots.updated_by_name IS '快照更新者的用户名';

-- 7. Payload 结构示例
/*
{
  "ver": 1,
  "medications": [
    {
      "id": "uuid",
      "name": "降压药",
      "dosage": "1片",
      "scheduled_time": "08:00",
      "accent": "#BFEFFF",
      "user_id": "uuid"
    }
  ],
  "medication_logs": [
    {
      "id": "uuid",
      "medication_id": "uuid",
      "medication_name": "降压药",
      "taken_at": "2025-12-19T08:05:00Z",
      "image_hash": "hash",
      "image_url": "url",
      "source_device": "device_id"
    }
  ],
  "user_settings": {
    "userName": "用户名",
    "avatar_url": "url",
    "theme": "light"
  },
  "snapshot_label": "用户名 202512191530"
}
*/
