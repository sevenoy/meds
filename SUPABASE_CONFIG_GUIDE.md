# Supabase 配置指南（生产环境）

## 问题说明

如果你在 **GitHub Pages**（`sevenoy.github.io`）上看到：

```
Supabase 未配置，无法保存快照
```

这是因为生产环境无法读取 `.env` 文件。

---

## 解决方案

### 方法1：在浏览器控制台配置（推荐）⭐

#### 步骤1：打开浏览器控制台

- **Chrome/Edge**：按 `F12` 或 `Ctrl+Shift+I`（Windows）/ `⌘+Option+I`（Mac）
- **Safari**：按 `⌘+Option+I`

#### 步骤2：在控制台执行以下命令

```javascript
// 设置 Supabase URL
localStorage.setItem('SUPABASE_URL', 'https://ptmgncjechjprxtndqon.supabase.co');

// 设置 Supabase Anon Key
localStorage.setItem('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0bWduY2plY2hqcHJ4dG5kcW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzA2NjIsImV4cCI6MjA4MTcwNjY2Mn0.vN58E7gBVxZXfhL_qEUfYkX7ihMjMUr5z1_KQAul5Hg');

console.log('✅ Supabase 配置已保存！');
```

#### 步骤3：刷新页面

```
按 F5 或 Ctrl+R（Windows）/ ⌘+R（Mac）
```

#### 步骤4：验证配置

再次点击【云端保存】按钮，应该不会再提示"未配置"了。

---

### 方法2：构建时注入环境变量

如果你想让所有用户都能使用，需要在构建时注入环境变量：

#### 步骤1：修改 GitHub Actions

在 `.github/workflows/deploy.yml` 中添加环境变量：

```yaml
- name: Build
  run: npm run build
  env:
    VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

#### 步骤2：在 GitHub 添加 Secrets

1. 进入 GitHub 仓库
2. Settings → Secrets and variables → Actions
3. 点击 "New repository secret"
4. 添加两个 secrets：
   - `SUPABASE_URL`: `https://ptmgncjechjprxtndqon.supabase.co`
   - `SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

#### 步骤3：重新部署

推送代码到 GitHub，GitHub Actions 会自动构建和部署。

---

## 验证配置是否成功

### 方法1：查看控制台日志

刷新页面后，在控制台应该看到：

```
✅ 使用 localStorage 中的 Supabase 配置
```

### 方法2：检查 localStorage

在控制台执行：

```javascript
console.log('SUPABASE_URL:', localStorage.getItem('SUPABASE_URL'));
console.log('SUPABASE_ANON_KEY:', localStorage.getItem('SUPABASE_ANON_KEY'));
```

应该显示你配置的值。

### 方法3：测试云端保存

点击【云端保存】按钮，应该显示：

```
✅ 快照已保存！

快照名称: 用户名 202512191530
保存时间: 2025-12-19 15:30:25
```

---

## 常见问题

### Q1：配置后还是提示"未配置"

**解决方案**：
1. 确认已刷新页面（F5）
2. 检查控制台是否有错误
3. 重新执行配置命令

### Q2：配置丢失了

**原因**：清除了浏览器缓存或使用了隐私模式

**解决方案**：重新执行配置命令

### Q3：多个浏览器都要配置吗？

**是的**，每个浏览器的 localStorage 是独立的，需要分别配置。

### Q4：手机上怎么配置？

**方法1**：使用方法2（GitHub Actions），构建时注入环境变量

**方法2**：手机浏览器也可以打开控制台（比较麻烦）：
- Chrome：访问 `chrome://inspect` → Remote Devices
- Safari：设置 → Safari → 高级 → Web Inspector

---

## 配置优先级

代码会按以下顺序查找配置：

1. **环境变量**（`.env` 文件，仅开发环境）
2. **localStorage**（浏览器本地存储）

---

## 安全提示

⚠️ **注意**：Supabase Anon Key 是公开的，可以放在客户端代码中。但请确保：

1. 在 Supabase 中启用了 **Row Level Security (RLS)**
2. 设置了正确的权限策略
3. 不要在客户端代码中使用 **Service Role Key**（这是私密的）

---

## 一键配置脚本

复制以下代码，在控制台一次性执行：

```javascript
// === 一键配置 Supabase ===
(function() {
  const SUPABASE_URL = 'https://ptmgncjechjprxtndqon.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0bWduY2plY2hqcHJ4dG5kcW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzA2NjIsImV4cCI6MjA4MTcwNjY2Mn0.vN58E7gBVxZXfhL_qEUfYkX7ihMjMUr5z1_KQAul5Hg';
  
  localStorage.setItem('SUPABASE_URL', SUPABASE_URL);
  localStorage.setItem('SUPABASE_ANON_KEY', SUPABASE_ANON_KEY);
  
  console.log('%c✅ Supabase 配置成功！', 'color: green; font-size: 16px; font-weight: bold;');
  console.log('%c📋 URL:', 'color: blue; font-weight: bold;', SUPABASE_URL);
  console.log('%c🔑 Key:', 'color: blue; font-weight: bold;', SUPABASE_ANON_KEY.substring(0, 50) + '...');
  console.log('%c🔄 请刷新页面（F5）使配置生效', 'color: orange; font-size: 14px; font-weight: bold;');
})();
```

---

**文档版本**：V251219.19  
**最后更新**：2025年12月19日
