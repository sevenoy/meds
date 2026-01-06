# 📝 注册 Supabase 用户指南

## 🎯 问题说明

**当前问题:**
- 登录页面使用本地验证,没有创建 Supabase 会话
- 导致 `getCurrentUserId()` 返回 `null`
- 所以添加药品时提示 "用户未登录"

**V260105.10 的修复:**
- 修改登录逻辑,使用 Supabase 认证
- 用户名自动转换为邮箱格式 (例: `sevenoy` → `sevenoy@gmail.com`)
- 创建真正的 Supabase 会话

---

## 🚀 需要的操作

### 方法1: Supabase Dashboard 注册 (推荐)

1. **打开 Supabase Dashboard**
   ```
   https://supabase.com/dashboard/project/ptmgncjechjprxtndqon
   ```

2. **进入 Authentication → Users**

3. **点击 "Add User"**

4. **填写信息:**
   - Email: `sevenoy@gmail.com`
   - Password: `jiajia`
   - Auto Confirm User: ✅ 勾选

5. **点击 "Create User"**

6. **完成!**

---

### 方法2: SQL 命令注册

1. **打开 Supabase Dashboard**
   ```
   https://supabase.com/dashboard/project/ptmgncjechjprxtndqon
   ```

2. **进入 SQL Editor**

3. **执行以下 SQL:**

```sql
-- 创建用户 sevenoy
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'sevenoy@gmail.com',
  crypt('jiajia', gen_salt('bf')),  -- 密码: jiajia
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);
```

4. **点击 "Run"**

5. **完成!**

---

### 方法3: 应用内注册 (暂时禁用)

**注意:** 当前应用禁用了注册功能,需要先启用。

1. **修改 `LoginPage.tsx`:**

```typescript
// 找到这一行 (Line 31-34):
if (isRegisterMode) {
  // 注册模式：暂时禁用，使用固定账号
  setError('请使用默认账号登录：sevenoy / jiajia');
  setLoading(false);
  return;
}

// 改为:
if (isRegisterMode) {
  // 注册模式
  console.log('🔐 尝试注册（Supabase 认证）:', email);
  
  const emailToUse = email.includes('@') ? email : `${email}@gmail.com`;
  
  const result = await signUp(emailToUse, password);
  
  if (result.error) {
    console.error('❌ Supabase 注册失败:', result.error);
    setError(`注册失败: ${result.error.message}`);
    setLoading(false);
    return;
  }
  
  console.log('✅ Supabase 注册成功:', result.data.user?.email);
  setError(null);
  alert('注册成功!请使用新账号登录');
  setIsRegisterMode(false);
  setLoading(false);
  return;
}
```

2. **清除缓存并刷新**

3. **点击 "没有账号?去注册"**

4. **填写信息并注册**

---

## 🔍 验证用户是否创建成功

### 方法1: Supabase Dashboard

1. **打开 Authentication → Users**
2. **查看用户列表**
3. **应该看到 `sevenoy@gmail.com`**

---

### 方法2: SQL 查询

```sql
SELECT id, email, created_at, email_confirmed_at
FROM auth.users
WHERE email = 'sevenoy@gmail.com';
```

**预期结果:**
```
id                                   | email              | created_at          | email_confirmed_at
-------------------------------------|--------------------|--------------------|--------------------
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx | sevenoy@gmail.com  | 2026-01-05 ...     | 2026-01-05 ...
```

---

## 🧪 测试登录

### 1. 清除缓存

```
进入 "我的" → 点击 "清除缓存"
```

### 2. 退出登录

```
进入 "我的" → 退出登录
```

### 3. 重新登录

**用户名:** `sevenoy`  
**密码:** `jiajia`

**或者:**

**邮箱:** `sevenoy@gmail.com`  
**密码:** `jiajia`

### 4. 查看控制台

**应该看到:**
```
🔐 尝试登录（Supabase 认证）: sevenoy
🌐 调用 Supabase 登录 API
📡 Supabase 登录响应: { data: { user: { ... }, session: { ... } }, error: null }
✅ Supabase 登录成功: sevenoy@gmail.com
```

### 5. 测试添加药品

**进入 "我的" → "药品管理"**

**添加一个测试药品**

**应该成功,无错误!** ✅

---

## 📊 控制台日志对比

### Before (本地认证)

```
🔐 尝试登录（本地认证）: sevenoy
✅ 本地认证成功

[用户操作: 添加药品]
🔍 [添加药品] 当前 payload 状态: null
⚠️ payload 为 null，尝试重新加载...
🔄 cloudLoadV2() 开始读取，userId: xxx
❌ 查询 app_state 失败: {...}
⚠️ 用户未登录，初始化本地 payload  ← 问题在这里!
❌ 添加药品失败: 用户未登录
```

### After (Supabase 认证)

```
🔐 尝试登录（Supabase 认证）: sevenoy
🌐 调用 Supabase 登录 API
📡 Supabase 登录响应: { data: { ... }, error: null }
✅ Supabase 登录成功: sevenoy@gmail.com

[用户操作: 添加药品]
🔍 [添加药品] 当前 payload 状态: 存在
✅ 新药品已保存到本地数据库
✅ 新药品已成功写入 payload 并同步到云端  ← 成功!
```

---

## 🎯 完成后的行为

**V260105.10 + Supabase 用户注册:**

✅ 登录时创建 Supabase 会话  
✅ `getCurrentUserId()` 返回真实的 user_id  
✅ 添加药品成功同步到云端  
✅ 多设备数据自动同步  
✅ RLS 规则正常工作  

---

## ⚠️ 重要提示

1. **必须先注册 Supabase 用户**
   - 使用 Supabase Dashboard 或 SQL 命令
   - 邮箱: `sevenoy@gmail.com`
   - 密码: `jiajia`

2. **清除缓存并重新登录**
   - 确保加载最新代码 (V260105.10)
   - 使用 Supabase 认证登录

3. **测试添加药品**
   - 应该成功,无 "用户未登录" 错误

4. **多设备同步**
   - 现在可以真正测试多设备同步了!

---

## 🚀 下一步

1. **注册 Supabase 用户** (方法1或2)
2. **清除缓存**
3. **退出并重新登录**
4. **测试添加药品**
5. **验证多设备同步**

---

© 2026 药盒助手 V260105.10 | Supabase 认证修复版本



