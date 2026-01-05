-- ====================================
-- 药品管理系统 - 数据库修复脚本
-- 添加 device_id 列以支持多设备同步
-- ====================================

-- 1. 为 medications 表添加 device_id 列
ALTER TABLE public.medications 
ADD COLUMN IF NOT EXISTS device_id text;

-- 2. 为 medication_logs 表添加 device_id 列
ALTER TABLE public.medication_logs 
ADD COLUMN IF NOT EXISTS device_id text;

-- 3. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_medications_device_id 
ON public.medications(device_id);

CREATE INDEX IF NOT EXISTS idx_medication_logs_device_id 
ON public.medication_logs(device_id);

-- 4. 刷新 PostgREST schema cache (非常重要!)
NOTIFY pgrst, 'reload schema';

-- 完成!
-- 执行成功后应该看到 "Success. No rows returned"

