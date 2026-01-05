-- ============================================
-- 强制版本同步 + 完全云端化迁移脚本
-- 目标：所有设备必须使用相同版本，所有数据从云端读取
-- ============================================

-- 1. 在 app_state 表添加 required_version 字段
ALTER TABLE app_state 
ADD COLUMN IF NOT EXISTS required_version TEXT;

-- 2. 设置当前最新版本（所有设备必须更新到此版本）
UPDATE app_state 
SET required_version = 'V260105.29'
WHERE required_version IS NULL;

-- 3. 添加 medications 表缺失字段（确保兼容）
ALTER TABLE medications 
ADD COLUMN IF NOT EXISTS accent TEXT,
ADD COLUMN IF NOT EXISTS device_id TEXT;

-- 4. 添加 medication_logs 表缺失字段
ALTER TABLE medication_logs 
ADD COLUMN IF NOT EXISTS device_id TEXT;

-- 5. 移除不再需要的本地同步字段（云端化后不再需要）
-- 注意：不删除 sync_state 和 local_id，因为可能有旧数据依赖
-- 但新代码不再使用这些字段

-- 6. 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_medications_user_device ON medications(user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_user_device ON medication_logs(user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_app_state_required_version ON app_state(required_version);

-- 7. 添加注释
COMMENT ON COLUMN app_state.required_version IS '强制要求的前端版本号，不一致则强制刷新';
COMMENT ON COLUMN medications.device_id IS '最后更新的设备ID（用于 Realtime 过滤）';
COMMENT ON COLUMN medication_logs.device_id IS '创建记录的设备ID（用于 Realtime 过滤）';

-- 完成
-- 执行后，所有设备在登录时会检查 app_state.required_version
-- 如果前端版本不匹配，会强制清除缓存并刷新

