# 快速启动开发环境

## 一键启动脚本

由于权限限制，请手动执行以下命令：

### 1. 安装依赖

```bash
# 前端依赖
cd frontend
npm install

# 后端依赖
cd ../backend
npm install
```

### 2. 配置环境变量

#### 前端 (`frontend/.env`)
```env
VITE_SUPABASE_URL=https://fzixpacqanjygrxsrcsy.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6aXhwYWNxYW5qeWdyeHNyY3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0Mzg2MzgsImV4cCI6MjA4MzAxNDYzOH0.6-LthX8jXaS3ZqdGbZcCe1NZ43upWckZPwAKnTKD9AU
```

#### 后端 (`backend/.env`)
```env
SUPABASE_URL=https://fzixpacqanjygrxsrcsy.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6aXhwYWNxYW5qeWdyeHNyY3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0Mzg2MzgsImV4cCI6MjA4MzAxNDYzOH0.6-LthX8jXaS3ZqdGbZcCe1NZ43upWckZPwAKnTKD9AU
SUPABASE_SERVICE_ROLE_KEY=从Supabase Dashboard获取
PORT=3001
NODE_ENV=development
```

### 3. 执行数据库迁移

1. 访问 https://supabase.com/dashboard
2. 选择项目 `fzixpacqanjygrxsrcsy`
3. 进入 **SQL Editor**
4. 复制并执行 `backend/database/schema.sql` 的内容

### 4. 启动开发服务器

#### 终端 1 - 后端
```bash
cd backend
npm run dev
```

#### 终端 2 - 前端
```bash
cd frontend
npm run dev
```

### 5. 访问应用

打开浏览器访问: **http://localhost:3000**

## 开发流程

1. **前端开发**: 修改 `frontend/src/` 下的文件，Vite 会自动热更新
2. **后端开发**: 修改 `backend/src/` 下的文件，tsx 会自动重启
3. **数据库变更**: 在 Supabase Dashboard 的 SQL Editor 中执行

## 常用命令

```bash
# 前端构建
cd frontend && npm run build

# 后端构建
cd backend && npm run build

# 类型检查
cd frontend && npx tsc --noEmit
cd backend && npx tsc --noEmit
```

## 下一步

- 查看 [DATABASE_SETUP.md](./DATABASE_SETUP.md) 了解数据库配置详情
- 查看 [TECHNICAL_WHITEPAPER.md](./TECHNICAL_WHITEPAPER.md) 了解技术架构

