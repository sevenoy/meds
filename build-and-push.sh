#!/bin/bash

# 构建并自动推送到 GitHub
# 用法: ./build-and-push.sh

set -e  # 遇到错误立即退出

echo "🚀 开始构建项目..."

# 构建项目
npm run build

echo "✅ 构建完成"

# 检查是否有构建产物
if [ ! -d "dist" ]; then
  echo "❌ 错误: dist 目录不存在"
  exit 1
fi

# 检查是否有未提交的更改
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "📝 检测到未提交的更改，先提交代码..."
  git add -A
  git commit -m "chore: 构建前提交更改" || true
fi

# 添加构建产物
echo "📦 添加构建产物到 Git..."
git add dist/

# 检查是否有需要提交的内容
if git diff --staged --quiet; then
  echo "ℹ️  没有新的构建产物需要提交"
else
  # 提交构建产物
  COMMIT_MSG="chore: 自动构建产物 - $(date +'%Y-%m-%d %H:%M:%S')"
  echo "💾 提交构建产物: $COMMIT_MSG"
  git commit -m "$COMMIT_MSG"
  
  # 推送到 GitHub
  echo "🚀 推送到 GitHub..."
  git push origin main
  
  echo "✅ 构建产物已推送到 GitHub"
fi

echo "🎉 完成！"

