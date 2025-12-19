# ⚙️ 用户设置多设备同步指南

## 🎯 功能特性

### ✅ 已实现

1. **用户设置云端存储**
   - 设置保存到 Supabase
   - 与用户账号绑定
   - 自动备份

2. **多设备实时同步**
   - 设备A修改设置 → 自动上传云端
   - 设备B实时接收 → 弹窗提示应用
   - 同步延迟 < 3秒

3. **离线支持**
   - 本地缓存设置
   - 离线可用
   - 联网后自动同步

---

## 📊 架构设计

### **数据流程：**

```
┌────────────────────────────────────────┐
│  设备A (iPhone)                        │
│                                        │
│  用户修改设置                           │
│      ↓                                 │
│  保存到本地 localStorage                │
│      ↓                                 │
│  上传到 Supabase                       │
└────────────────┬───────────────────────┘
                 │
                 ↓
        ☁️ Supabase Cloud
        user_settings 表
                 │
                 ↓
┌────────────────┴───────────────────────┐
│  设备B (Android)                       │
│                                        │
│  Realtime 监听                         │
│      ↓                                 │
│  收到更新通知                           │
│      ↓                                 │
│  弹窗："其他设备更新了设置"             │
│      ↓                                 │
│  用户确认 → 应用新设置                  │
└────────────────────────────────────────┘
```

---

## 🗄️ 数据库结构

### **Supabase 表：user_settings**

```sql
CREATE TABLE user_settings (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,  -- 关联用户
  settings JSONB,          -- 设置内容
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### **设置数据格式（JSON）：**

```json
{
  "theme": "light",
  "notifications": true,
  "language": "zh-CN",
  "calendar": {
    "showWeekends": true,
    "startOfWeek": 1
  },
  "customKey": "customValue"
}
```

---

## 🚀 部署步骤

### **步骤1: 创建数据库表**

1. 登录 Supabase Dashboard
   ```
   https://supabase.com/dashboard/project/ptmgncjechjprxtndqon
   ```

2. 进入 **SQL Editor**

3. 复制并执行 `supabase-user-settings-schema.sql`

4. 确认表创建成功：
   - 进入 **Table Editor**
   - 应该看到 `user_settings` 表

---

### **步骤2: 测试设置同步**

#### **在浏览器控制台测试：**

```javascript
// 1. 导入设置服务（需要在代码中）
import { getUserSettings, saveUserSettings } from './src/services/userSettings';

// 2. 保存设置
await saveUserSettings({
  theme: 'dark',
  notifications: true
});
// 应该看到: ☁️ 同步用户设置到云端...
// 应该看到: ✅ 用户设置已同步到云端

// 3. 读取设置
const settings = await getUserSettings();
console.log('当前设置:', settings);
// 应该输出: {theme: 'dark', notifications: true}
```

---

## 💻 代码使用示例

### **保存设置：**

```typescript
import { saveUserSettings, updateUserSettings } from './src/services/userSettings';

// 完整保存
await saveUserSettings({
  theme: 'dark',
  notifications: true,
  language: 'zh-CN'
});

// 部分更新
await updateUserSettings({
  theme: 'light'  // 只更新theme，其他保持不变
});
```

### **读取设置：**

```typescript
import { getUserSettings } from './src/services/userSettings';

const settings = await getUserSettings();
console.log('主题:', settings.theme);
console.log('通知:', settings.notifications);
```

### **实时监听：**

```typescript
import { initSettingsRealtimeSync } from './src/services/userSettings';

// 初始化监听
const cleanup = initSettingsRealtimeSync((newSettings) => {
  console.log('收到设置更新:', newSettings);
  // 应用新设置...
});

// 清理监听（组件卸载时）
cleanup();
```

---

## 🔄 多设备同步流程

### **场景：修改主题设置**

#### **设备A操作：**

```typescript
// 用户在设备A切换到深色模式
await updateUserSettings({ theme: 'dark' });

// 自动执行：
// 1. 保存到 localStorage
// 2. 上传到 Supabase
// 3. 触发 Realtime 事件
```

#### **设备B自动响应：**

```javascript
// Realtime 监听器自动触发
📥 收到用户设置更新: {type: 'UPDATE', new: {...}}
🔔 其他设备更新了设置，自动应用...
✅ 设置已自动更新

// 弹出确认框
"其他设备更新了设置，是否立即应用？"
[取消] [确定]

// 用户点击确定
→ window.location.reload()
→ 应用新设置（深色模式）
```

---

## 🎨 应用场景示例

### **1. 主题切换同步**

```typescript
// 设备A: 切换到深色模式
await updateUserSettings({ theme: 'dark' });

// 设备B: 自动收到通知并应用
// → 所有设备主题统一
```

### **2. 通知偏好同步**

```typescript
// 设备A: 关闭通知
await updateUserSettings({ notifications: false });

// 设备B: 自动同步
// → 所有设备不再推送通知
```

### **3. 语言设置同步**

```typescript
// 设备A: 切换语言
await updateUserSettings({ language: 'en-US' });

// 设备B: 自动切换语言
// → 多设备语言一致
```

---

## 🔍 调试和测试

### **1. 查看当前设置**

```typescript
const settings = await getUserSettings();
console.table(settings);
```

### **2. 查看同步状态**

```javascript
// 检查本地缓存
const local = localStorage.getItem('user_settings');
console.log('本地设置:', JSON.parse(local));

// 检查最后同步时间
const lastSync = localStorage.getItem('settings_last_sync');
console.log('最后同步:', new Date(parseInt(lastSync)));
```

### **3. 手动触发同步**

```typescript
// 强制从云端拉取
const settings = await getUserSettings();
console.log('云端设置:', settings);

// 强制推送到云端
await saveUserSettings(settings);
```

---

## ⚠️ 注意事项

### **1. 数据大小限制**

- JSONB 字段理论上无限制
- 建议单个设置对象 < 100KB
- 避免存储大文件或图片

### **2. 冲突处理**

- 采用 **LWW (Last Write Wins)** 策略
- 最后写入的设置会覆盖之前的
- 建议：不要同时在多设备修改同一设置

### **3. 性能优化**

- 本地优先，云端同步
- 读取时优先使用本地缓存
- 写入时先保存本地，再异步上传

---

## 📝 待扩展功能

### **可以添加的设置项：**

```typescript
interface UserSettings {
  // 界面设置
  theme: 'light' | 'dark';
  language: string;
  fontSize: 'small' | 'medium' | 'large';
  
  // 通知设置
  notifications: boolean;
  notificationTime: string;
  soundEnabled: boolean;
  
  // 日历设置
  calendar: {
    showWeekends: boolean;
    startOfWeek: 0 | 1;  // 0=周日, 1=周一
    defaultView: 'month' | 'week';
  };
  
  // 隐私设置
  shareData: boolean;
  biometricAuth: boolean;
  
  // 自定义设置
  [key: string]: any;
}
```

---

## 🆘 故障排查

### **Q: 设置没有同步？**

**检查：**
1. 是否已登录？
2. 网络连接是否正常？
3. 浏览器控制台是否有错误？

**解决：**
```typescript
// 手动触发同步
await saveUserSettings(await getUserSettings());
```

---

### **Q: 两个设备设置冲突？**

**原因：** 同时修改了相同的设置

**解决：** 最后保存的会生效（LWW策略）

---

### **Q: 数据库表不存在？**

**错误信息：** `relation "user_settings" does not exist`

**解决：**
1. 确认已执行 `supabase-user-settings-schema.sql`
2. 检查 Supabase 项目是否正确
3. 刷新 Schema cache

---

## 📊 性能指标

| 操作 | 延迟 | 说明 |
|------|------|------|
| 读取设置 | < 50ms | 从本地缓存读取 |
| 保存设置 | < 100ms | 先保存本地 |
| 云端同步 | < 500ms | 上传到Supabase |
| 实时通知 | < 3s | 其他设备收到 |
| 应用设置 | 即时 | 刷新页面 |

---

**最后更新**: 2025年12月19日  
**版本**: V251219.3
