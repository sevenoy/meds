# 数据库设置指南

## Supabase 配置信息

- **URL**: https://fzixpacqanjygrxsrcsy.supabase.co
- **Anon Key**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6aXhwYWNxYW5qeWdyeHNyY3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0Mzg2MzgsImV4cCI6MjA4MzAxNDYzOH0.6-LthX8jXaS3ZqdGbZcCe1NZ43upWckZPwAKnTKD9AU

## 步骤 1: 执行数据库迁移

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目: `fzixpacqanjygrxsrcsy`
3. 进入 **SQL Editor**
4. 复制 `backend/database/schema.sql` 的全部内容
5. 粘贴到 SQL Editor 并执行

## 步骤 2: 配置 Storage

1. 在 Supabase Dashboard 中进入 **Storage**
2. 创建新的 Bucket:
   - **名称**: `medication-photos`
   - **公开访问**: ❌ 关闭（私有）
   - **文件大小限制**: 5MB
   - **允许的文件类型**: `image/jpeg, image/png, image/webp`

3. 配置 Storage Policies:
   - 进入 Bucket 的 **Policies** 标签
   - 创建策略允许用户上传自己的照片

## 步骤 3: 启用 Realtime

1. 在 Supabase Dashboard 中进入 **Database**
2. 点击 **Replication** 标签
3. 为以下表启用 Realtime:
   - ✅ `medications`
   - ✅ `medication_logs`
   - ✅ `user_settings`
   - ✅ `app_snapshots`

## 步骤 4: 配置环境变量

### 前端环境变量

创建 `frontend/.env` 文件：

```env
VITE_SUPABASE_URL=https://fzixpacqanjygrxsrcsy.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6aXhwYWNxYW5qeWdyeHNyY3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0Mzg2MzgsImV4cCI6MjA4MzAxNDYzOH0.6-LthX8jXaS3ZqdGbZcCe1NZ43upWckZPwAKnTKD9AU
```

### 后端环境变量

创建 `backend/.env` 文件：

```env
SUPABASE_URL=https://fzixpacqanjygrxsrcsy.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6aXhwYWNxYW5qeWdyeHNyY3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0Mzg2MzgsImV4cCI6MjA4MzAxNDYzOH0.6-LthX8jXaS3ZqdGbZcCe1NZ43upWckZPwAKnTKD9AU
SUPABASE_SERVICE_ROLE_KEY=请从Supabase Dashboard的Settings > API中获取
PORT=3001
NODE_ENV=development
```

**获取 Service Role Key**:
1. 在 Supabase Dashboard 中进入 **Settings** > **API**
2. 复制 `service_role` key（⚠️ 保密，不要提交到 Git）

## 步骤 5: 安装依赖

### 前端
```bash
cd frontend
npm install
```

### 后端
```bash
cd backend
npm install
```

## 步骤 6: 启动开发服务器

### 终端 1 - 后端
```bash
cd backend
npm run dev
```

后端将在 http://localhost:3001 运行

### 终端 2 - 前端
```bash
cd frontend
npm run dev
```

前端将在 http://localhost:3000 运行

## 验证设置

1. 打开 http://localhost:3000
2. 注册一个新账号
3. 登录后应该能看到主界面
4. 尝试添加一个药品

## 故障排查

### 数据库连接失败
- 检查环境变量是否正确
- 确认 Supabase 项目已激活
- 检查网络连接

### Realtime 不工作
- 确认已在 Dashboard 中启用 Realtime
- 检查 RLS 策略是否正确
- 查看浏览器控制台日志

### Storage 上传失败
- 确认 Bucket 已创建
- 检查 Storage Policies 配置
- 验证文件大小和类型限制

