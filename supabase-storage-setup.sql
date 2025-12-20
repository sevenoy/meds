-- Supabase Storage 设置脚本
-- 用于创建 medication-images bucket 和配置权限

-- 1. 创建 Storage Bucket（如果不存在）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medication-images',
  'medication-images',
  true, -- 公开访问
  5242880, -- 5MB 文件大小限制
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] -- 允许的图片类型
)
ON CONFLICT (id) DO NOTHING;

-- 2. 创建存储策略：用户只能上传自己的文件
CREATE POLICY "Users can upload own medication images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'medication-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. 创建存储策略：用户只能读取自己的文件
CREATE POLICY "Users can read own medication images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'medication-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. 创建存储策略：用户只能删除自己的文件
CREATE POLICY "Users can delete own medication images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'medication-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. 创建存储策略：公开读取（因为 bucket 是公开的）
CREATE POLICY "Public can read medication images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'medication-images');

-- 注意：
-- 1. 在 Supabase Dashboard 中执行此脚本
-- 2. 路径结构：{userId}/{medicationId}/{timestamp}_{filename}
-- 3. 文件大小限制：5MB
-- 4. 支持的图片格式：JPEG, PNG, WebP, HEIC, HEIF

