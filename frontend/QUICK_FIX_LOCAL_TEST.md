# 快速修复本地测试登录问题

## 问题

出现 "Invalid login credentials" 错误。

## 解决方案

### 方法 1: 确保环境变量已设置

在终端中执行：

```bash
cd "/Users/lorenmac/Downloads/26年软件项目/Meds/meds/frontend"

# 检查 .env 文件
cat .env

# 如果没有 VITE_LOCAL_TEST_MODE，添加它
echo "VITE_LOCAL_TEST_MODE=true" >> .env
```

### 方法 2: 重启前端服务器

**重要**: 修改 `.env` 文件后必须重启服务器！

1. 停止当前服务器（按 `Ctrl+C`）
2. 重新启动：

```bash
npm run dev
```

### 方法 3: 检查浏览器控制台

打开浏览器开发者工具（F12），查看 Console 标签，应该看到：

```
[Auth] 本地测试模式: true
[Auth] 使用本地登录
```

如果看到 `[Auth] 本地测试模式: false`，说明环境变量没有正确加载。

### 方法 4: 手动验证环境变量

在浏览器控制台执行：

```javascript
console.log('VITE_LOCAL_TEST_MODE:', import.meta.env.VITE_LOCAL_TEST_MODE);
```

应该输出 `true`。

## 测试账号

启用本地测试模式后，使用：

```
邮箱: test@example.com
密码: 123456
```

或任意邮箱和至少6位密码。

## 如果仍然失败

### 临时解决方案：直接修改代码

编辑 `frontend/src/lib/supabase.ts`，在 `signIn` 函数开头添加：

```typescript
// 强制启用本地测试模式（临时）
const isLocalTest = true; // 改为 true
```

然后重启服务器。

### 或者：使用 Supabase 真实账号

如果不想使用本地测试模式，可以在 Supabase Dashboard 中：

1. 访问 https://supabase.com/dashboard
2. 选择项目 `fzixpacqanjygrxsrcsy`
3. 进入 **Authentication** > **Users**
4. 点击 **Add user** 创建测试账号
5. 使用创建的账号登录

## 验证步骤

1. ✅ 确认 `.env` 文件包含 `VITE_LOCAL_TEST_MODE=true`
2. ✅ 重启前端服务器
3. ✅ 打开浏览器控制台，查看日志
4. ✅ 使用测试账号登录

