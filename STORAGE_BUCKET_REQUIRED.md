# Storage Bucket 必须存在

## ⚠️ 重要提示

**`medication-images` Storage bucket 必须存在，否则图片功能将无法使用。**

## 为什么需要 bucket？

从 V260105.31 开始，应用**不再支持 DataURL 降级模式**。如果 Storage bucket 不存在，应用会：

1. ❌ **拒绝创建记录**：上传图片失败时，不会继续创建服药记录
2. ✅ **明确提示用户**：显示错误信息 "Storage bucket medication-images 不存在，请先创建 bucket"
3. ✅ **防止数据膨胀**：不会将 22MB 的 DataURL 写入数据库

## 如何创建 bucket

### 方法 1：使用 SQL 脚本（推荐）

1. 打开 Supabase Dashboard
2. 进入 **SQL Editor**
3. 执行以下 SQL：

```sql
-- 创建 bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medication-images',
  'medication-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- 创建公开读取策略
CREATE POLICY IF NOT EXISTS "Public can read medication images"
ON storage.objects FOR SELECT
USING (bucket_id = 'medication-images');

-- 创建用户上传策略
CREATE POLICY IF NOT EXISTS "Users can upload medication images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'medication-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 创建用户删除策略
CREATE POLICY IF NOT EXISTS "Users can delete their own medication images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'medication-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### 方法 2：手动创建

1. 在 Supabase Dashboard 中，点击 **Storage**
2. 点击 **New bucket**
3. 填写：
   - **Name**: `medication-images`
   - **Public bucket**: ✅ 勾选
   - **File size limit**: `5242880` (5MB)
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp, image/heic, image/heif`
4. 点击 **Create bucket**
5. 然后执行上述 SQL 脚本中的策略部分（第 15-50 行）

## 验证设置

执行以下 SQL 查询来验证：

```sql
-- 1. 检查 bucket 是否存在
SELECT * FROM storage.buckets WHERE id = 'medication-images';

-- 2. 检查策略是否存在
SELECT * FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%medication%';

-- 3. 检查 bucket 配置
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'medication-images';
```

## 错误处理

如果 bucket 不存在，应用会：

1. **上传图片时**：抛出错误 `Storage bucket medication-images 不存在，请先创建 bucket`
2. **UI 提示**：显示 alert 提示用户创建 bucket
3. **阻止创建记录**：不会继续创建服药记录，避免数据不一致

## 迁移说明

如果你之前使用的是 DataURL 模式（图片以 Base64 存储在数据库中），需要：

1. ✅ 创建 `medication-images` bucket
2. ✅ 重新上传图片到 Storage
3. ✅ 更新数据库中的 `image_path` 字段为 Storage URL

**注意**：旧版本的 DataURL 数据仍然可以显示，但新记录必须使用 Storage。

---

**文档版本**：V260105.31  
**最后更新**：2025年12月20日

