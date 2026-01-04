#!/bin/bash

# 自动更新版本号脚本
# 用法: ./update-version.sh [major|minor|patch]
# 示例: ./update-version.sh patch  # 递增补丁号

set -e

VERSION_FILE="src/config/version.ts"

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 自动更新版本号工具${NC}"
echo ""

# 检查版本文件是否存在
if [ ! -f "$VERSION_FILE" ]; then
    echo -e "${YELLOW}❌ 版本文件不存在: $VERSION_FILE${NC}"
    exit 1
fi

# 读取当前版本号
CURRENT_VERSION=$(grep "APP_VERSION = " "$VERSION_FILE" | sed "s/.*'\(.*\)'.*/\1/")
echo -e "${BLUE}📌 当前版本: ${YELLOW}$CURRENT_VERSION${NC}"

# 生成新版本号 (基于日期)
NEW_DATE=$(date +"%y%m%d")

# 检查是否是同一天
if [[ $CURRENT_VERSION == V${NEW_DATE}.* ]]; then
    # 同一天，递增序号
    CURRENT_SEQ=$(echo $CURRENT_VERSION | sed "s/V${NEW_DATE}\.//")
    NEW_SEQ=$(printf "%02d" $((10#$CURRENT_SEQ + 1)))
    NEW_VERSION="V${NEW_DATE}.${NEW_SEQ}"
else
    # 新的一天，从01开始
    NEW_VERSION="V${NEW_DATE}.01"
fi

echo -e "${GREEN}✨ 新版本号: ${YELLOW}$NEW_VERSION${NC}"
echo ""

# 询问确认
read -p "是否更新版本号? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}❌ 已取消${NC}"
    exit 0
fi

# 更新版本号文件
sed -i.bak "s/APP_VERSION = '.*'/APP_VERSION = '$NEW_VERSION'/" "$VERSION_FILE"
rm -f "${VERSION_FILE}.bak"

echo -e "${GREEN}✅ 版本号已更新为: $NEW_VERSION${NC}"
echo ""

# 显示修改内容
echo -e "${BLUE}📝 修改内容:${NC}"
git diff "$VERSION_FILE" || true
echo ""

# 询问是否提交
read -p "是否提交到 Git? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add "$VERSION_FILE"
    git commit -m "🔖 更新版本号到 $NEW_VERSION"
    echo -e "${GREEN}✅ 已提交到 Git${NC}"
    echo ""
    
    read -p "是否推送到远程仓库? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git push
        echo -e "${GREEN}✅ 已推送到远程仓库${NC}"
    fi
fi

echo ""
echo -e "${GREEN}🎉 版本更新完成!${NC}"
echo -e "${BLUE}📌 新版本: ${YELLOW}$NEW_VERSION${NC}"

