# 版本号更新规则

## ⚠️ 重要规则：每次推送 GitHub 前必须升级版本号！

### 版本号格式

**格式**: `V + 年月日（6位） + . + 总更新次数`

**示例**:
- `V251217.37` - 2025年12月17日，总第37次更新
- `V251219.6` - 2025年12月19日，总第6次更新

### 版本号规则

1. **日期部分**: 年份后两位 + 月份两位 + 日期两位（YYMMDD）
2. **更新次数**: 累计的总更新次数（不会因为跨天而重置）
3. **每次提交必须递增**: 每次推送到 GitHub 前，版本号必须 +1

## 推送到 GitHub 前的检查清单

### 1. 读取当前版本号

```bash
# 从 index.html 读取当前版本号
grep "const APP_VERSION" index.html
```

### 2. 计算新版本号

```
日期部分 = 当前日期（YYMMDD格式）
更新次数 = 上一个版本的更新次数 + 1

新版本号 = V + 日期部分 + . + 更新次数
```

**示例**:
- 上一版本: `V251219.5`
- 今天日期: 2025年12月19日 → `251219`
- 新版本: `V251219.6`（同一天，递增次数）

如果跨天：
- 上一版本: `V251219.6`
- 明天日期: 2025年12月20日 → `251220`
- 新版本: `V251220.7`（跨天，但次数继续累计）

### 3. 需要更新版本号的文件（4个）

✅ **index.html** - 更新 `APP_VERSION` 常量
```html
const APP_VERSION = 'V251219.6';  // ← 更新这里
```

✅ **sw.js** - 更新 `VERSION` 常量
```javascript
const VERSION = 'V251219.6';  // ← 更新这里
```

✅ **manifest.json** - 更新 `version` 字段
```json
{
  "version": "251219.6"  // ← 更新这里（去掉V前缀）
}
```

✅ **package.json** - 更新 `version` 字段
```json
{
  "version": "251219.6"  // ← 更新这里（去掉V前缀）
}
```

### 4. 提交信息格式

```
feat: V<版本号> - <主要功能描述>

## 本次更新

- <更新内容1>
- <更新内容2>
- ...

版本: V<版本号>
```

## 完整的推送流程

### 步骤1: 读取此规则文件
```bash
# 每次推送前先读取规则
cat VERSION_RULES.md
```

### 步骤2: 升级版本号
```bash
# 1. 计算新版本号
# 2. 更新 4 个文件（index.html, sw.js, manifest.json, package.json）
# 3. 验证版本号一致性
```

### 步骤3: 提交更改
```bash
git add -A
git commit -m "feat: V<新版本号> - <更新描述>"
```

### 步骤4: 推送到 GitHub
```bash
git push origin main
```

## 版本历史记录

### V251219.6 (当前)
- 修复头像多设备同步功能
- 优化用户体验
- 添加版本更新规则

### V251219.5
- 用户头像功能
- 增强设置同步

### V251217.37
- 初始版本

## 注意事项

1. ⚠️ **永远不要跳过版本号更新**
2. ⚠️ **确保 4 个文件的版本号完全一致**
3. ⚠️ **提交信息必须包含版本号**
4. ⚠️ **推送前检查 Service Worker 版本号是否更新**
5. ⚠️ **版本号只能递增，不能回退**

## 自动化脚本（可选）

可以创建一个自动更新版本号的脚本：

```bash
#!/bin/bash
# update-version.sh

# 读取当前版本号
CURRENT_VERSION=$(grep "const APP_VERSION" index.html | grep -o "V[0-9]*\.[0-9]*")
echo "当前版本: $CURRENT_VERSION"

# 计算新版本号
CURRENT_NUM=$(echo $CURRENT_VERSION | cut -d'.' -f2)
NEW_NUM=$((CURRENT_NUM + 1))
DATE_PART=$(date +%y%m%d)
NEW_VERSION="V${DATE_PART}.${NEW_NUM}"
echo "新版本: $NEW_VERSION"

# 更新所有文件
# ...
```

## 快速检查命令

```bash
# 检查所有文件的版本号是否一致
echo "index.html:" && grep "const APP_VERSION" index.html
echo "sw.js:" && grep "const VERSION" sw.js
echo "manifest.json:" && grep "version" manifest.json | head -1
echo "package.json:" && grep "\"version\"" package.json | head -1
```

---

**记住**: 版本号是应用更新的关键！每次推送前必须检查和更新！
