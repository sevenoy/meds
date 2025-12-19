# AI 助手规则：推送 GitHub 前必须升级版本号

## ⚠️ 强制规则

**每次推送到 GitHub 之前，必须执行以下步骤：**

### 步骤1: 读取版本更新规则
```bash
# 首先读取规则文档
Read: VERSION_RULES.md
```

### 步骤2: 检查当前版本号
```bash
# 从 index.html 读取当前版本号
grep "const APP_VERSION" index.html
```

### 步骤3: 计算并更新新版本号

#### 版本号格式
```
V + YYMMDD + . + 累计次数

示例：V251219.6
- 25: 2025年
- 12: 12月
- 19: 19日
- 6: 第6次更新
```

#### 更新规则
- 同一天更新：只递增次数（V251219.5 → V251219.6）
- 跨天更新：更新日期+递增次数（V251219.6 → V251220.7）

### 步骤4: 更新4个文件

必须同时更新以下文件，确保版本号一致：

1. **index.html**
```javascript
const APP_VERSION = 'V251219.6';  // ← 更新这里
```

2. **public/sw.js**
```javascript
const VERSION = 'V251219.6';  // ← 更新这里
```

3. **public/manifest.json**
```json
"version": "V251219.6"  // ← 更新这里
```

4. **package.json**
```json
"version": "251219.6"  // ← 更新这里（去掉V前缀）
```

### 步骤5: 验证版本号一致性

运行检查命令：
```bash
echo "=== 版本号检查 ===" && \
echo "index.html:" && grep "const APP_VERSION" index.html && \
echo "sw.js:" && grep "const VERSION" public/sw.js && \
echo "manifest.json:" && grep "version" public/manifest.json | head -1 && \
echo "package.json:" && grep "\"version\"" package.json | head -1
```

### 步骤6: 提交时包含版本号

提交信息格式：
```
feat: V<版本号> - <功能描述>

## 本次更新
- <更新内容1>
- <更新内容2>

版本: V<版本号>
```

### 步骤7: 推送到 GitHub

```bash
git add -A
git commit -m "feat: V<版本号> - <描述>"
git push origin main
```

## ❌ 禁止的操作

1. ❌ 推送时不升级版本号
2. ❌ 版本号不一致（4个文件必须同步）
3. ❌ 提交信息不包含版本号
4. ❌ 跳过版本号（必须递增）
5. ❌ 版本号回退

## ✅ 正确的推送流程总结

```
1. 读取 VERSION_RULES.md
2. 检查当前版本号
3. 计算新版本号
4. 更新 4 个文件
5. 验证版本号一致性
6. git add -A
7. git commit -m "feat: V<新版本> - <描述>"
8. git push origin main
```

## 📋 检查清单（每次推送前）

- [ ] 已读取 VERSION_RULES.md
- [ ] 已计算新版本号
- [ ] 已更新 index.html
- [ ] 已更新 public/sw.js
- [ ] 已更新 public/manifest.json
- [ ] 已更新 package.json
- [ ] 已验证版本号一致性
- [ ] 提交信息包含版本号
- [ ] 准备推送到 GitHub

## 版本历史

### V251219.6 (最新)
- 添加版本更新规则
- 建立版本管理制度

### V251219.5
- 修复头像多设备同步
- 优化用户体验

---

**记住**：这是强制规则，每次推送前必须执行！
