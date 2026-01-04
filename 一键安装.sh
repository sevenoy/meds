#!/bin/bash

# 药盒助手 - 一键安装脚本
# 使用方法: bash 一键安装.sh

echo "🚀 开始安装药盒助手开发环境..."
echo ""

# 获取项目目录
PROJECT_DIR="/Users/lorenmac/Downloads/26年软件项目/Meds/meds"
cd "$PROJECT_DIR" || exit

echo "📁 项目目录: $PROJECT_DIR"
echo ""

# 1. 创建前端环境变量
echo "📝 创建前端环境变量..."
cat > frontend/.env << 'EOF'
VITE_SUPABASE_URL=https://fzixpacqanjygrxsrcsy.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6aXhwYWNxYW5qeWdyeHNyY3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0Mzg2MzgsImV4cCI6MjA4MzAxNDYzOH0.6-LthX8jXaS3ZqdGbZcCe1NZ43upWckZPwAKnTKD9AU
EOF
echo "✅ 前端环境变量已创建"

# 2. 创建后端环境变量
echo "📝 创建后端环境变量..."
cat > backend/.env << 'EOF'
SUPABASE_URL=https://fzixpacqanjygrxsrcsy.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6aXhwYWNxYW5qeWdyeHNyY3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0Mzg2MzgsImV4cCI6MjA4MzAxNDYzOH0.6-LthX8jXaS3ZqdGbZcCe1NZ43upWckZPwAKnTKD9AU
SUPABASE_SERVICE_ROLE_KEY=请从Supabase Dashboard获取
PORT=3001
NODE_ENV=development
EOF
echo "✅ 后端环境变量已创建"

echo ""
echo "📦 开始安装依赖..."
echo ""

# 3. 安装前端依赖
echo "📦 安装前端依赖..."
cd frontend
if [ -d "node_modules" ]; then
    echo "⚠️  前端依赖已存在，跳过安装"
else
    echo "正在安装前端依赖（这可能需要几分钟）..."
    npm install --legacy-peer-deps
    if [ $? -eq 0 ]; then
        echo "✅ 前端依赖安装完成"
    else
        echo "❌ 前端依赖安装失败，请手动执行: cd frontend && npm install"
    fi
fi
cd ..

# 4. 安装后端依赖
echo ""
echo "📦 安装后端依赖..."
cd backend
if [ -d "node_modules" ]; then
    echo "⚠️  后端依赖已存在，跳过安装"
else
    echo "正在安装后端依赖（这可能需要几分钟）..."
    npm install
    if [ $? -eq 0 ]; then
        echo "✅ 后端依赖安装完成"
    else
        echo "❌ 后端依赖安装失败，请手动执行: cd backend && npm install"
    fi
fi
cd ..

echo ""
echo "✅ 安装完成！"
echo ""
echo "📋 下一步操作："
echo ""
echo "1. 执行数据库迁移："
echo "   - 访问 https://supabase.com/dashboard"
echo "   - 选择项目 fzixpacqanjygrxsrcsy"
echo "   - 进入 SQL Editor"
echo "   - 执行 backend/database/schema.sql"
echo ""
echo "2. 启动后端服务器："
echo "   cd backend && npm run dev"
echo ""
echo "3. 启动前端服务器（新终端）："
echo "   cd frontend && npm run dev"
echo ""
echo "4. 访问应用："
echo "   http://localhost:3000"
echo ""

