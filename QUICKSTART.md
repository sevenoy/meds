# 快速开始指南

## 5 分钟快速启动

### 1. 克隆/下载项目

```bash
cd meds
```

### 2. 安装依赖

```bash
# 前端
cd frontend
npm install

# 后端
cd ../backend
npm install
```

### 3. 配置 Supabase

1. 访问 [supabase.com](https://supabase.com) 创建项目
2. 在项目设置中获取：
   - Project URL
   - anon/public key
   - service_role key

3. 执行数据库迁移：
   - 在 Supabase Dashboard → SQL Editor
   - 执行 `backend/database/schema.sql`

### 4. 设置环境变量

**前端** (`frontend/.env`):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**后端** (`backend/.env`):
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3001
```

### 5. 启动开发服务器

**终端 1 - 后端**:
```bash
cd backend
npm run dev
```

**终端 2 - 前端**:
```bash
cd frontend
npm run dev
```

### 6. 访问应用

打开浏览器访问: http://localhost:3000

## 首次使用

1. **注册账号**: 使用邮箱和密码注册
2. **添加药品**: 点击"添加药品"按钮
3. **记录服药**: 点击药品卡片，拍照记录

## 常见问题

### Q: 无法连接 Supabase？
A: 检查环境变量是否正确，确保 Supabase 项目已激活

### Q: 实时同步不工作？
A: 检查 Supabase Realtime 是否启用，查看浏览器控制台日志

### Q: 拍照功能无法使用？
A: 确保浏览器已授予摄像头权限

## 下一步

- 阅读 [SETUP.md](./SETUP.md) 了解详细配置
- 阅读 [TECHNICAL_WHITEPAPER.md](./TECHNICAL_WHITEPAPER.md) 了解技术架构
- 查看 [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) 了解项目结构

## 需要帮助？

查看项目文档或提交 Issue。

