# 自动更新版本号工具

## 📋 工具说明

本项目包含2个版本号自动更新工具:

1. **update-version.js** (推荐) - Node.js 版本,跨平台
2. **update-version.sh** - Bash 脚本版本,适用于 macOS/Linux

---

## 🚀 使用方法

### 方法1: 使用 npm 命令 (推荐)

```bash
npm run update-version
```

### 方法2: 直接运行 Node.js 脚本

```bash
node update-version.js
```

### 方法3: 运行 Shell 脚本 (macOS/Linux)

```bash
./update-version.sh
```

---

## 📖 使用示例

### 完整交互流程

```bash
$ npm run update-version

🔄 自动更新版本号工具

📌 当前版本: V260105.02
✨ 新版本号: V260105.03

是否更新版本号? (y/n): y

✅ 版本号已更新为: V260105.03

📝 修改内容:
diff --git a/src/config/version.ts b/src/config/version.ts
index abc1234..def5678 100644
--- a/src/config/version.ts
+++ b/src/config/version.ts
@@ -4,4 +4,4 @@
  * 仅用于 console.log、页面展示、调试信息
  * 严禁用于 URL
  */
-export const APP_VERSION = 'V260105.02';
+export const APP_VERSION = 'V260105.03';

是否提交到 Git? (y/n): y

✅ 已提交到 Git

是否推送到远程仓库? (y/n): y

✅ 已推送到远程仓库

🎉 版本更新完成!
📌 新版本: V260105.03
```

---

## 🎯 版本号规则

### 格式

```
V[YY][MM][DD].[序号]
```

### 示例

```
V260105.01  - 2026年1月5日 第1个版本
V260105.02  - 2026年1月5日 第2个版本 (同一天递增)
V260105.03  - 2026年1月5日 第3个版本
V260106.01  - 2026年1月6日 第1个版本 (新的一天重置)
```

### 自动递增逻辑

1. **同一天**: 序号递增 (01 → 02 → 03 ...)
2. **新的一天**: 序号重置为 01

---

## ⚙️ 工作流程

### 完整开发流程

```bash
# 1. 修改代码
vim App.tsx

# 2. 自动更新版本号
npm run update-version
# 选择 y → y → y (更新 → 提交 → 推送)

# 3. 构建项目
npm run build

# 4. 部署
# (部署到服务器或 GitHub Pages)

# 5. 清除用户缓存
# 用户在应用中: "我的" → "清除缓存"
```

### 快速流程 (仅更新版本号)

```bash
npm run update-version
# 选择 y → n (仅更新,不提交)
```

---

## 🔍 脚本功能详解

### 1. 读取当前版本号

脚本会自动从 `src/config/version.ts` 读取当前版本号:

```typescript
export const APP_VERSION = 'V260105.02';
                            ↑ 自动解析
```

### 2. 生成新版本号

- 获取当前日期
- 检查是否与当前版本同一天
- 同一天则递增序号,否则重置为 01

### 3. 更新文件

直接修改 `src/config/version.ts` 文件内容

### 4. Git 集成 (可选)

- 自动 `git add`
- 自动 `git commit` (提交信息: `🔖 更新版本号到 V260105.03`)
- 可选 `git push`

---

## 📝 手动更新版本号

如果不想使用脚本,也可以手动修改:

```bash
# 编辑版本号文件
vim src/config/version.ts

# 修改为:
export const APP_VERSION = 'V260105.03';

# 提交
git add src/config/version.ts
git commit -m "🔖 更新版本号到 V260105.03"
git push
```

---

## 🛠️ 故障排查

### 问题1: 脚本没有执行权限

**错误:**
```bash
bash: ./update-version.sh: Permission denied
```

**解决:**
```bash
chmod +x update-version.sh
chmod +x update-version.js
```

### 问题2: Node.js 未安装

**错误:**
```bash
node: command not found
```

**解决:**
- 安装 Node.js: https://nodejs.org/
- 或使用 Shell 脚本版本: `./update-version.sh`

### 问题3: Git 未初始化

**错误:**
```bash
fatal: not a git repository
```

**解决:**
```bash
git init
git remote add origin <your-repo-url>
```

### 问题4: 版本号格式错误

**错误:**
```bash
❌ 无法解析当前版本号
```

**解决:**
检查 `src/config/version.ts` 格式是否正确:
```typescript
export const APP_VERSION = 'V260105.02';  // ✅ 正确
export const APP_VERSION = "V260105.02";  // ❌ 必须用单引号
export const APP_VERSION = 'v260105.02';  // ❌ V必须大写
```

---

## 🎨 自定义配置

### 修改版本号格式

编辑 `update-version.js` 第 49-59 行:

```javascript
// 当前格式: V260105.01
const newDate = `${year}${month}${day}`;
const newVersion = `V${newDate}.${newSeq}`;

// 自定义格式示例:
// 格式1: v2026.01.05-01
const newVersion = `v${year + 2000}.${month}.${day}-${newSeq}`;

// 格式2: 2026.1.5.1
const newVersion = `${year + 2000}.${parseInt(month)}.${parseInt(day)}.${parseInt(newSeq)}`;

// 格式3: 1.0.1 (语义化版本)
const newVersion = `1.0.${parseInt(newSeq)}`;
```

### 修改版本号文件路径

编辑 `update-version.js` 第 10 行:

```javascript
const VERSION_FILE = 'src/config/version.ts';  // 默认路径

// 修改为其他路径:
const VERSION_FILE = 'config/version.js';
const VERSION_FILE = 'package.json';  // 需要修改解析逻辑
```

---

## 📊 集成到 CI/CD

### GitHub Actions

创建 `.github/workflows/version-bump.yml`:

```yaml
name: Auto Version Bump

on:
  push:
    branches: [ main ]

jobs:
  version-bump:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Update Version
        run: |
          echo "y" | npm run update-version
      
      - name: Commit and Push
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add src/config/version.ts
          git commit -m "🤖 自动更新版本号" || echo "No changes"
          git push
```

### 钩子脚本 (pre-commit)

创建 `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# 每次提交前自动更新版本号
echo "y" | npm run update-version > /dev/null 2>&1
git add src/config/version.ts
```

---

## 🌟 最佳实践

### 1. 每次修改代码后更新版本号

```bash
# 修改代码
vim App.tsx

# 更新版本号
npm run update-version
```

### 2. 在 commit 信息中包含版本号

```bash
git commit -m "修复日历颜色显示 - V260105.03"
```

### 3. 在 README 中显示版本号

```markdown
# 药盒助手

当前版本: V260105.03
```

### 4. 定期清理旧版本记录

```bash
# 查看所有版本历史
git log --oneline --grep="更新版本号"

# 压缩多个版本更新提交
git rebase -i HEAD~10
```

---

## 📚 相关文档

- `src/config/version.ts` - 版本号配置文件
- `App.tsx` - 引用版本号的主文件
- `package.json` - npm 脚本配置

---

## ✅ 功能清单

- [x] 自动读取当前版本号
- [x] 自动生成新版本号 (基于日期)
- [x] 同一天自动递增序号
- [x] 新的一天重置序号
- [x] 更新版本号文件
- [x] 显示 Git diff
- [x] 可选 Git 提交
- [x] 可选 Git 推送
- [x] 跨平台支持 (Node.js)
- [x] 颜色输出
- [x] 交互式确认

---

© 2026 药盒助手 | 自动化版本管理工具

