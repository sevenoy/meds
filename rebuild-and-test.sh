#!/bin/bash

echo "🔄 重新构建并测试..."
echo ""

# 1. 验证key
echo "1️⃣ 验证API Key..."
KEY=$(grep VITE_SUPABASE_ANON_KEY .env | cut -d'=' -f2)
echo "   Key长度: ${#KEY} 字符"

if [ ${#KEY} -lt 150 ]; then
  echo "   ❌ Key太短，请重新复制完整的key"
  exit 1
fi

echo "   ✅ Key长度正常"
echo ""

# 2. 重新构建
echo "2️⃣ 重新构建项目..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "   ✅ 构建成功"
else
  echo "   ❌ 构建失败"
  exit 1
fi
echo ""

# 3. 停止旧服务器
echo "3️⃣ 停止旧的预览服务器..."
pkill -f "vite preview" 2>/dev/null
sleep 1
echo "   ✅ 已停止"
echo ""

# 4. 启动新服务器（后台）
echo "4️⃣ 启动新的预览服务器..."
echo ""
echo "   📍 访问地址："
echo "   http://localhost:4173/meds/"
echo "   或"
echo "   http://localhost:4174/meds/"
echo ""
echo "💡 现在可以测试登录了！"
echo ""

# 启动服务器
npm run preview
