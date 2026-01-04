# Supabase Storage 设置指南

## 问题说明

如果上传照片时遇到 **"Bucket not found"** 错误，说明 Supabase Storage 中的 `medication-images` bucket 还没有创建。

---

## 解决方案

### 方法1：使用 SQL 脚本（推荐）⭐

#### 步骤1：打开 Supabase Dashboard

1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击左侧菜单的 **SQL Editor**

#### 步骤2：执行 SQL 脚本

复制并执行 `supabase-storage-setup.sql` 文件中的内容：

```sql
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
```

#### 步骤3：验证

执行完成后，应该看到：
- ✅ Bucket 创建成功
- ✅ 策略创建成功

---

### 方法2：使用 Supabase Dashboard（图形界面）

#### 步骤1：创建 Bucket

1. 在 Supabase Dashboard 中，点击左侧菜单的 **Storage**
2. 点击 **New bucket**
3. 填写信息：
   - **Name**: `medication-images`
   - **Public bucket**: ✅ 勾选（公开访问）
   - **File size limit**: `5 MB`
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp, image/heic, image/heif`
4. 点击 **Create bucket**

#### 步骤2：配置权限策略

1. 点击创建的 `medication-images` bucket
2. 点击 **Policies** 标签
3. 点击 **New Policy**
4. 选择 **For full customization**，然后创建以下策略：

**策略1：用户上传自己的文件**
- Policy name: `Users can upload own medication images`
- Allowed operation: `INSERT`
- Target roles: `authenticated`
- USING expression: `bucket_id = 'medication-images'`
- WITH CHECK expression: `(storage.foldername(name))[1] = auth.uid()::text`

**策略2：用户读取自己的文件**
- Policy name: `Users can read own medication images`
- Allowed operation: `SELECT`
- Target roles: `authenticated`
- USING expression: `bucket_id = 'medication-images' AND (storage.foldername(name))[1] = auth.uid()::text`

**策略3：用户删除自己的文件**
- Policy name: `Users can delete own medication images`
- Allowed operation: `DELETE`
- Target roles: `authenticated`
- USING expression: `bucket_id = 'medication-images' AND (storage.foldername(name))[1] = auth.uid()::text`

**策略4：公开读取**
- Policy name: `Public can read medication images`
- Allowed operation: `SELECT`
- Target roles: `public`
- USING expression: `bucket_id = 'medication-images'`

---

## 验证设置

### 检查 Bucket 是否存在

在 Supabase Dashboard 的 Storage 页面，应该能看到 `medication-images` bucket。

### 测试上传

1. 在应用中尝试上传一张照片
2. 如果成功，照片应该保存在 `{userId}/{medicationId}/{timestamp}_{filename}` 路径下

---

## 文件路径结构

上传的照片会按照以下结构存储：

```
medication-images/
  └── {userId}/
      └── {medicationId}/
          └── {timestamp}_{filename}
```

例如：
```
medication-images/
  └── abc123-def456-ghi789/
      └── med_1234567890/
          └── 1703123456789_photo.jpg
```

---

## 常见问题

### Q1: 执行 SQL 时提示权限错误

**解决方案**：确保你使用的是 Supabase Dashboard 的 SQL Editor，而不是通过客户端连接。

### Q2: 上传后无法访问图片

**解决方案**：
1. 检查 bucket 是否设置为公开（`public: true`）
2. 检查是否有 "Public can read medication images" 策略

### Q3: 上传文件大小超过限制

**解决方案**：
- 默认限制是 5MB
- 可以在 SQL 中修改 `file_size_limit` 值（单位：字节）
- 例如：10MB = `10485760`

### Q4: 不支持的文件类型

**解决方案**：
- 检查 `allowed_mime_types` 是否包含你需要的文件类型
- 常见图片类型：
  - `image/jpeg` - JPEG
  - `image/png` - PNG
  - `image/webp` - WebP
  - `image/heic` - HEIC (iOS)
  - `image/heif` - HEIF

---

## 安全说明

⚠️ **重要**：

1. **公开 Bucket**：`medication-images` 设置为公开，意味着任何人都可以通过 URL 访问图片。如果图片包含敏感信息，建议：
   - 将 bucket 设置为私有
   - 使用签名 URL 访问
   - 添加额外的访问控制

2. **文件大小限制**：默认 5MB，防止上传过大文件

3. **MIME 类型限制**：只允许图片类型，防止上传恶意文件

---

**文档版本**：V251219.23  
**最后更新**：2025年12月20日

