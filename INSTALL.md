# 安装指南

## ⚠️ 重要提示

由于系统权限限制，npm 安装需要在您的终端中手动执行。

## 步骤 1: 切换到项目目录

```bash
cd "/Users/lorenmac/Downloads/26年软件项目/Meds/meds"
```

## 步骤 2: 创建环境变量文件

### 前端环境变量 (`frontend/.env`)

在终端中执行：

```bash
cat > frontend/.env << 'EOF'
VITE_SUPABASE_URL=https://fzixpacqanjygrxsrcsy.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6aXhwYWNxYW5qeWdyeHNyY3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0Mzg2MzgsImV4cCI6MjA4MzAxNDYzOH0.6-LthX8jXaS3ZqdGbZcCe1NZ43upWckZPwAKnTKD9AU
EOF
```

### 后端环境变量 (`backend/.env`)

```bash
cat > backend/.env << 'EOF'
SUPABASE_URL=https://fzixpacqanjygrxsrcsy.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6aXhwYWNxYW5qeWdyeHNyY3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0Mzg2MzgsImV4cCI6MjA4MzAxNDYzOH0.6-LthX8jXaS3ZqdGbZcCe1NZ43upWckZPwAKnTKD9AU
SUPABASE_SERVICE_ROLE_KEY=请从Supabase Dashboard获取
PORT=3001
NODE_ENV=development
EOF
```

## 步骤 3: 安装前端依赖

```bash
cd frontend
npm install
cd ..
```

如果遇到权限错误，可以尝试：
```bash
sudo npm install
```

或者使用 yarn：
```bash
cd frontend
yarn install
cd ..
```

## 步骤 4: 安装后端依赖

```bash
cd backend
npm install
cd ..
```

如果遇到权限错误，可以尝试：
```bash
sudo npm install
```

或者使用 yarn：
```bash
cd backend
yarn install
cd ..
```

## 步骤 5: 验证安装

检查 node_modules 是否已创建：

```bash
ls frontend/node_modules
ls backend/node_modules
```

## 步骤 6: 执行数据库迁移

1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目 `fzixpacqanjygrxsrcsy`
3. 进入 **SQL Editor**
4. 复制 `backend/database/schema.sql` 的全部内容
5. 粘贴并执行

## 步骤 7: 启动开发服务器

### 终端 1 - 后端

```bash
cd "/Users/lorenmac/Downloads/26年软件项目/Meds/meds/backend"
npm run dev
```

### 终端 2 - 前端

```bash
cd "/Users/lorenmac/Downloads/26年软件项目/Meds/meds/frontend"
npm run dev
```

## 步骤 8: 访问应用

打开浏览器访问: **http://localhost:3000**

## 常见问题

### Q: npm install 权限错误
A: 尝试使用 `sudo npm install` 或使用 `yarn install`

### Q: 找不到命令
A: 确保已安装 Node.js 和 npm：
```bash
node --version
npm --version
```

### Q: 端口被占用
A: 修改 `backend/.env` 中的 `PORT` 值

## 下一步

安装完成后，查看：
- [START_DEV.md](./START_DEV.md) - 开发指南
- [DATABASE_SETUP.md](./DATABASE_SETUP.md) - 数据库配置

