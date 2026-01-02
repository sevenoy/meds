# CloudBase 迁移指南

## 📋 概述

本指南将帮助你将 Meds 药盒助手从 Supabase 迁移到腾讯云 CloudBase（云开发）。

---

## 🎯 为什么选择 CloudBase？

1. **更好的访问性** - 在中国和亚洲地区访问速度快
2. **无需 VPN** - 国内外都可以直接访问
3. **完整功能** - 提供数据库、存储、云函数等完整服务
4. **免费额度** - 提供慷慨的免费额度

---

## 🚀 步骤 1: 创建 CloudBase 环境

### 1.1 注册腾讯云账号

1. 访问 [腾讯云官网](https://cloud.tencent.com/)
2. 注册并登录账号
3. 完成实名认证

### 1.2 开通云开发服务

1. 访问 [云开发控制台](https://console.cloud.tencent.com/tcb)
2. 点击"新建环境"
3. 选择"按量计费"（有免费额度）
4. 环境名称：`meds-prod`（或自定义）
5. 记录**环境 ID**（格式：`meds-xxxxx`）

### 1.3 配置环境

在云开发控制台：

1. **数据库**
   - 进入"数据库" → "集合"
   - 创建以下集合：
     - `medications` - 药品数据
     - `medication_logs` - 服药记录
     - `user_settings` - 用户设置

2. **存储**
   - 进入"存储" → "文件管理"
   - 创建文件夹：
     - `medication-images` - 服药照片
     - `user-avatars` - 用户头像

3. **用户管理**
   - 进入"用户管理"
   - 启用"用户名密码登录"

---

## 🔧 步骤 2: 配置应用

### 2.1 设置环境 ID

在项目根目录创建 `.env` 文件：

```env
VITE_CLOUDBASE_ENV_ID=your-env-id-here
```

或者在浏览器控制台设置：

```javascript
localStorage.setItem('CLOUDBASE_ENV_ID', 'your-env-id-here');
```

### 2.2 更新 package.json

CloudBase SDK 已安装：

```json
{
  "dependencies": {
    "@cloudbase/js-sdk": "^1.7.3"
  }
}
```

---

## 📊 步骤 3: 数据库设计

### medications 集合

```javascript
{
  _id: "auto-generated",
  user_id: "string",
  name: "string",
  dosage: "string",
  scheduled_time: "string",
  color: "string",
  created_at: "date",
  updated_at: "date"
}
```

### medication_logs 集合

```javascript
{
  _id: "auto-generated",
  user_id: "string",
  medication_id: "string",
  medication_name: "string",
  taken_at: "date",
  image_url: "string",
  created_at: "date",
  updated_at: "date",
  sync_state: "string" // "clean" | "dirty"
}
```

### user_settings 集合

```javascript
{
  _id: "auto-generated",
  user_id: "string",
  avatar_url: "string",
  created_at: "date",
  updated_at: "date"
}
```

---

## 🔐 步骤 4: 配置安全规则

在云开发控制台 → 数据库 → 权限设置：

### medications 集合权限

```javascript
{
  "read": "auth.uid == doc.user_id",
  "write": "auth.uid == doc.user_id"
}
```

### medication_logs 集合权限

```javascript
{
  "read": "auth.uid == doc.user_id",
  "write": "auth.uid == doc.user_id"
}
```

### user_settings 集合权限

```javascript
{
  "read": "auth.uid == doc.user_id",
  "write": "auth.uid == doc.user_id"
}
```

---

## 📁 步骤 5: 迁移代码（已完成）

### 已创建的文件

- ✅ `src/lib/cloudbase.ts` - CloudBase 客户端配置

### 需要更新的文件

以下文件需要从 Supabase 迁移到 CloudBase：

1. `src/services/medication.ts` - 药品服务
2. `src/services/sync.ts` - 同步服务
3. `src/services/storage.ts` - 存储服务
4. `src/services/userSettings.ts` - 用户设置服务
5. `src/components/LoginPage.tsx` - 登录页面
6. `src/components/AvatarUpload.tsx` - 头像上传

---

## 🧪 步骤 6: 测试

### 6.1 本地测试

```bash
npm run dev
```

### 6.2 测试清单

- [ ] 用户注册
- [ ] 用户登录
- [ ] 添加药品
- [ ] 修改药品
- [ ] 删除药品
- [ ] 记录服药
- [ ] 上传照片
- [ ] 上传头像
- [ ] 数据同步

---

## 📈 步骤 7: 数据迁移

如果你有现有的 Supabase 数据需要迁移：

### 7.1 导出 Supabase 数据

在 Supabase Dashboard：
1. 进入 Table Editor
2. 导出每个表为 CSV

### 7.2 导入到 CloudBase

1. 编写迁移脚本
2. 使用 CloudBase SDK 批量导入
3. 验证数据完整性

---

## 💰 费用说明

### 免费额度（每月）

- **数据库读**: 50,000 次
- **数据库写**: 30,000 次
- **存储空间**: 5 GB
- **下载流量**: 5 GB
- **云函数调用**: 100,000 次

### 超出免费额度

- 数据库读: ¥0.015/万次
- 数据库写: ¥0.05/万次
- 存储: ¥0.0043/GB/天
- 流量: ¥0.18/GB

对于个人应用，免费额度通常足够使用。

---

## 🔄 Realtime 同步

CloudBase 支持实时数据库，可以实现类似 Supabase Realtime 的功能：

```javascript
// 监听数据变化
const watcher = db.collection('medications')
  .where({
    user_id: userId
  })
  .watch({
    onChange: (snapshot) => {
      console.log('数据变更:', snapshot.docs);
      // 更新 UI
    },
    onError: (error) => {
      console.error('监听错误:', error);
    }
  });

// 取消监听
watcher.close();
```

---

## 📚 参考资源

- [CloudBase 官方文档](https://cloud.tencent.com/document/product/876)
- [CloudBase JS SDK](https://docs.cloudbase.net/api-reference/webv2/initialization)
- [数据库文档](https://docs.cloudbase.net/api-reference/webv2/database)
- [存储文档](https://docs.cloudbase.net/api-reference/webv2/storage)
- [用户认证文档](https://docs.cloudbase.net/api-reference/webv2/authentication)

---

## ❓ 常见问题

### Q: CloudBase 和 Supabase 有什么区别？

A: 
- **相同点**: 都提供 BaaS（后端即服务），包括数据库、存储、认证
- **不同点**: 
  - CloudBase 在中国访问更快
  - CloudBase 使用腾讯云基础设施
  - API 和 SDK 不同

### Q: 需要重写所有代码吗？

A: 不需要。主要是替换 API 调用，业务逻辑保持不变。

### Q: 数据会丢失吗？

A: 不会。可以先迁移代码，然后导出/导入数据。

### Q: 费用会很高吗？

A: 对于个人应用，免费额度通常足够。可以在控制台监控使用量。

---

## ✅ 迁移检查清单

### 准备工作
- [ ] 注册腾讯云账号
- [ ] 开通云开发服务
- [ ] 创建环境并记录环境 ID
- [ ] 创建数据库集合
- [ ] 配置安全规则
- [ ] 启用用户名密码登录

### 代码迁移
- [ ] 安装 CloudBase SDK
- [ ] 配置环境 ID
- [ ] 更新认证逻辑
- [ ] 更新数据库操作
- [ ] 更新存储服务
- [ ] 更新 Realtime 同步

### 测试验证
- [ ] 本地测试通过
- [ ] 用户认证正常
- [ ] 数据读写正常
- [ ] 文件上传正常
- [ ] 实时同步正常

### 部署上线
- [ ] 构建生产版本
- [ ] 部署到服务器
- [ ] 验证线上功能
- [ ] 监控使用情况

---

**迁移指南版本**: v1.0  
**最后更新**: 2025-01-02  
**适用版本**: Meds V251219.43+

