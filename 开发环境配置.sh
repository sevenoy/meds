#!/bin/bash

# 药盒助手 - 开发环境配置脚本

echo "🚀 开始配置开发环境..."

# 1. 创建前端环境变量文件
echo "📝 创建前端环境变量..."
cat > frontend/.env << EOF
VITE_SUPABASE_URL=https://fzixpacqanjygrxsrcsy.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6aXhwYWNxYW5qeWdyeHNyY3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0Mzg2MzgsImV4cCI6MjA4MzAxNDYzOH0.6-LthX8jXaS3ZqdGbZcCe1NZ43upWckZPwAKnTKD9AU
EOF

# 2. 创建后端环境变量文件
echo "📝 创建后端环境变量..."
cat > backend/.env << EOF
SUPABASE_URL=https://fzixpacqanjygrxsrcsy.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6aXhwYWNxYW5qeWdyeHNyY3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0Mzg2MzgsImV4cCI6MjA4MzAxNDYzOH0.6-LthX8jXaS3ZqdGbZcCe1NZ43upWckZPwAKnTKD9AU
SUPABASE_SERVICE_ROLE_KEY=请从Supabase Dashboard获取
PORT=3001
NODE_ENV=development
EOF

# 3. 安装前端依赖
echo "📦 安装前端依赖..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "前端依赖已存在，跳过安装"
fi
cd ..

# 4. 安装后端依赖
echo "📦 安装后端依赖..."
cd backend
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "后端依赖已存在，跳过安装"
fi
cd ..

echo "✅ 环境配置完成！"
echo ""
echo "📋 下一步操作："
echo "1. 在 Supabase Dashboard 执行数据库迁移 (backend/database/schema.sql)"
echo "2. 启动后端: cd backend && npm run dev"
echo "3. 启动前端: cd frontend && npm run dev"
echo "4. 访问: http://localhost:3000"

