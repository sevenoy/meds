# 🔧 修复 "Invalid API key" 错误

## 📊 当前状态

```
✅ VITE_SUPABASE_URL: https://ptmgncjechjprxtndqon.supabase.co
⚠️  VITE_SUPABASE_ANON_KEY: 196字符（可能不完整）
```

---

## 🎯 解决方案

### **步骤1: 获取正确的 API Key**

1. **打开 Supabase Dashboard**
   ```
   https://supabase.com/dashboard/project/ptmgncjechjprxtndqon
   ```

2. **导航到 API 设置**
   - 点击左侧菜单 **⚙️ Settings**
   - 点击 **API**

3. **找到并复制 API Keys**
   
   在 **Project API keys** 部分，你会看到：
   
   **anon public key:**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ...（很长的字符串）
   ```
   
   ⚠️ **注意：**
   - 这个key通常有 **200-250** 字符
   - 以 `eyJ` 开头
   - 包含两个点（`.`），分成3部分
   - **必须完整复制，不能有空格或换行**

4. **完整复制**
   - 点击 **Copy** 按钮（推荐）
   - 或手动全选复制（确保完整）

---

### **步骤2: 更新 .env 文件**

1. **打开项目根目录的 `.env` 文件**
   ```bash
   /Volumes/SST7/软件项目/1218Meds/meds/.env
   ```

2. **完全替换旧的key**
   ```bash
   VITE_SUPABASE_URL=https://ptmgncjechjprxtndqon.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0bWduY2plY2hqcHJ4dG5kcW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1OTU4MjUsImV4cCI6MjA1MDE3MTgyNX0.完整的key
   ```
   
   ⚠️ **重要：**
   - 整个key必须在**同一行**
   - **不能**有空格
   - **不能**有换行
   - **不能**有引号（除非key本身包含）

3. **保存文件**

---

### **步骤3: 验证配置**

运行检查脚本：
```bash
cd /Volumes/SST7/软件项目/1218Meds/meds
node check-env.js
```

应该看到：
```
✅ VITE_SUPABASE_ANON_KEY: eyJhbGc...
   长度: 220+ 字符  ← 应该在200-250之间
```

---

### **步骤4: 重启服务器**

**如果使用开发服务器：**
```bash
# 停止当前服务器（Ctrl+C）
npm run dev
```

**如果使用预览服务器：**
```bash
# 重新构建和预览
npm run build
npm run preview
```

---

### **步骤5: 清除浏览器缓存**

1. **按 F12** 打开开发者工具
2. **右键点击刷新按钮**
3. 选择 **"清空缓存并硬性重新加载"**

或者：

**浏览器控制台执行：**
```javascript
localStorage.clear()
sessionStorage.clear()
caches.keys().then(keys => 
  Promise.all(keys.map(k => caches.delete(k)))
).then(() => location.reload(true))
```

---

## 🔍 常见错误

### **错误1: Key被截断**

**现象：**
```
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFz
```

**原因：** 复制时没有选中完整内容

**解决：** 使用Supabase Dashboard的 **Copy** 按钮

---

### **错误2: Key包含换行**

**现象：**
```
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0bWduY...
```

**原因：** 复制时包含了HTML格式或手动换行

**解决：** 确保整个key在同一行

---

### **错误3: Key包含空格**

**现象：**
```
VITE_SUPABASE_ANON_KEY=eyJhbGc iOiJIU zI1NiIs
```

**原因：** 复制时混入了空格

**解决：** 重新复制，确保没有空格

---

### **错误4: 使用了错误的key**

**现象：** 复制了 `service_role` key 而不是 `anon` key

**解决：** 
- ❌ 不要用 `service_role` key（这是服务端用的，有完整权限）
- ✅ 使用 `anon public` key（这是客户端用的）

---

## 📝 .env 文件完整示例

```bash
# Supabase配置
# 从 Supabase Dashboard → Settings → API 获取

# Project URL
VITE_SUPABASE_URL=https://ptmgncjechjprxtndqon.supabase.co

# anon public key (客户端使用)
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0bWduY2plY2hqcHJ4dG5kcW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1OTU4MjUsImV4cCI6MjA1MDE3MTgyNX0.完整的key不能截断

# 注意：
# 1. 整个key必须在同一行
# 2. 不能有空格或换行
# 3. key长度通常在200-250字符
# 4. 以 eyJ 开头
# 5. 包含两个点（.）分成3部分
```

---

## 🎯 验证步骤

### **1. 检查环境变量**
```bash
node check-env.js
```

应该输出：
```
✅ VITE_SUPABASE_URL: https://ptmgncjechjprxtndqon.supabase.co
✅ VITE_SUPABASE_ANON_KEY: eyJhbGc...
   长度: 220+ 字符
```

### **2. 测试连接**

在浏览器控制台执行：
```javascript
// 检查环境变量是否加载
console.log('URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('Key长度:', import.meta.env.VITE_SUPABASE_ANON_KEY?.length)
```

### **3. 尝试登录**

- 用户名: `sevenoy`
- 密码: `jiajia`

观察控制台日志：
```
🔐 尝试登录: sevenoy@gmail.com
🌐 Supabase模式：调用登录API
📡 Supabase登录响应: {...}
✅ 登录成功  ← 应该看到这个
```

---

## 🆘 仍然失败？

### **检查项目是否匹配**

1. **确认URL和Key来自同一个项目**
   - URL中的项目ID: `ptmgncjechjprxtndqon`
   - Key中应该包含相同的项目引用

2. **解码JWT检查**
   
   在浏览器控制台：
   ```javascript
   // 解码JWT查看内容
   const key = 'eyJhbGc...你的完整key'
   const parts = key.split('.')
   const payload = JSON.parse(atob(parts[1]))
   console.log('JWT Payload:', payload)
   
   // 应该看到：
   // {
   //   iss: "supabase",
   //   ref: "ptmgncjechjprxtndqon",  ← 应该匹配URL中的ID
   //   role: "anon",
   //   ...
   // }
   ```

### **API Key可能已重置**

如果Supabase项目的API key被重置过：
1. 旧的key会失效
2. 需要获取新的key
3. 更新 `.env` 文件

### **网络问题**

测试能否访问Supabase：
```bash
curl https://ptmgncjechjprxtndqon.supabase.co
```

应该返回API信息，不应该报错。

---

## 📞 需要帮助？

如果按照以上步骤仍然失败，请提供：

1. **环境变量检查结果**
   ```bash
   node check-env.js
   ```

2. **浏览器控制台完整日志**
   - 登录尝试日志
   - 错误信息

3. **JWT解码结果**
   ```javascript
   const parts = '你的key'.split('.')
   JSON.parse(atob(parts[1]))
   ```

4. **Supabase Dashboard 截图**
   - Settings → API 页面
   - 确认项目ID和key

---

**最后更新**: 2025年12月19日
