# Storage Bucket 诊断指南

## 问题：上传照片时返回 "Bucket not found"

### 快速诊断步骤

#### 1. 检查 Bucket 是否存在

在 Supabase Dashboard 中：

1. 访问：https://supabase.com/dashboard
2. 选择你的项目
3. 点击左侧菜单的 **Storage**
4. 查看是否有 `medication-images` bucket

**如果没有看到**：
- 执行 `supabase-storage-setup.sql` 脚本
- 或手动创建（见下方）

#### 2. 检查 Bucket 配置

点击 `medication-images` bucket，检查：

- ✅ **Public bucket**: 应该是 `true`（公开）
- ✅ **File size limit**: 建议 `5 MB` 或更大
- ✅ **Allowed MIME types**: 应该包含 `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`

#### 3. 检查权限策略

在 bucket 的 **Policies** 标签页，应该有以下策略：

1. **Users can upload own medication images** (INSERT)
2. **Users can read own medication images** (SELECT)  
3. **Users can delete own medication images** (DELETE)
4. **Public can read medication images** (SELECT, public)

如果缺少任何策略，执行 `supabase-storage-setup.sql` 脚本。

#### 4. 检查用户登录状态

在浏览器控制台执行：

```javascript
// 检查是否已登录
localStorage.getItem('isLoggedIn') // 应该是 'true'

// 检查 Supabase 配置
localStorage.getItem('SUPABASE_URL') // 应该有值
localStorage.getItem('SUPABASE_ANON_KEY') // 应该有值
```

#### 5. 手动测试上传

在浏览器控制台执行：

```javascript
// 测试 bucket 是否存在
const { data, error } = await supabase.storage
  .from('medication-images')
  .list('', { limit: 1 });

if (error) {
  console.error('❌ Bucket 不存在或无法访问:', error);
} else {
  console.log('✅ Bucket 存在，可以访问');
}
```

---

## 解决方案

### 方案1：执行 SQL 脚本（推荐）

1. 在 Supabase Dashboard 中打开 **SQL Editor**
2. 复制 `supabase-storage-setup.sql` 的全部内容
3. 粘贴并执行
4. 刷新页面，重新尝试上传

### 方案2：手动创建 Bucket

1. 在 Supabase Dashboard 中，点击 **Storage**
2. 点击 **New bucket**
3. 填写：
   - **Name**: `medication-images`
   - **Public bucket**: ✅ 勾选
   - **File size limit**: `5242880` (5MB)
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp, image/heic, image/heif`
4. 点击 **Create bucket**

然后执行 `supabase-storage-setup.sql` 中的策略部分（第 15-50 行）。

### 方案3：使用本地存储（临时方案）

如果暂时无法创建 bucket，应用会自动降级到 DataURL 模式：
- ✅ 图片会保存在本地（IndexedDB）
- ✅ 功能完全正常
- ⚠️ 图片不会同步到云端
- ⚠️ 图片数据会存储在数据库中（可能较大）

---

## 常见错误和解决方案

### 错误1: "Bucket not found"

**原因**：Bucket 还没有创建

**解决**：执行 `supabase-storage-setup.sql` 脚本

### 错误2: "new row violates row-level security policy"

**原因**：权限策略配置不正确

**解决**：检查并重新执行策略部分的 SQL

### 错误3: "The resource already exists"

**原因**：Bucket 已经存在，但可能配置不正确

**解决**：
1. 删除现有 bucket
2. 重新执行 SQL 脚本
3. 或手动检查 bucket 配置

### 错误4: 上传成功但无法访问图片

**原因**：Bucket 不是公开的，或缺少公开读取策略

**解决**：
1. 确保 bucket 设置为公开（`public: true`）
2. 确保有 "Public can read medication images" 策略

---

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

---

## 自动降级功能

如果 bucket 不存在，应用会自动：
1. ✅ 使用 DataURL 保存图片到本地
2. ✅ 显示友好的提示信息
3. ✅ 功能完全正常（只是不存储在云端）

这意味着即使 bucket 没有创建，应用也能正常工作！

---

**文档版本**：V251219.23  
**最后更新**：2025年12月20日

