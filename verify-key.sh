#!/bin/bash
echo "🔍 验证API Key..."
echo ""

# 读取key
KEY=$(grep VITE_SUPABASE_ANON_KEY .env | cut -d'=' -f2)

echo "📏 Key长度: ${#KEY} 字符"
echo "🔤 开头: ${KEY:0:20}..."
echo "🔤 结尾: ...${KEY: -20}"
echo ""

# 检查格式
if [[ $KEY == eyJ* ]]; then
  echo "✅ Key以eyJ开头（JWT格式）"
else
  echo "❌ Key不是JWT格式"
fi

# 检查点的数量
DOTS=$(echo "$KEY" | tr -cd '.' | wc -c)
if [ $DOTS -eq 2 ]; then
  echo "✅ Key有2个点（3个部分）"
else
  echo "❌ Key应该有2个点，当前有 $DOTS 个"
fi

# 检查长度
if [ ${#KEY} -ge 150 ] && [ ${#KEY} -le 300 ]; then
  echo "✅ Key长度合理"
else
  echo "⚠️  Key长度异常（应该在150-300之间）"
fi
