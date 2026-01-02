# Supabase Realtime 多设备同步设置指南

## 📋 概述

本指南将帮助你在 Supabase 中启用 Realtime 功能，实现多设备即时数据同步。

---

## 🚀 快速开始

### 步骤 1: 执行数据库迁移

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 进入 **SQL Editor**
4. 创建新查询
5. 复制 `supabase-realtime-migration.sql` 的全部内容
6. 粘贴到编辑器
7. 点击 **Run** 执行

**预期结果**：
```
✅ Realtime 多设备同步迁移完成！
📋 下一步：
1. 在 Supabase Dashboard → Database → Replication 中启用表的 Realtime
2. 启用以下表：medications, medication_logs, user_settings
3. 重启应用以测试多设备同步功能
```

---

### 步骤 2: 启用表的 Realtime 功能

#### 2.1 进入 Replication 设置

1. 在 Supabase Dashboard 左侧菜单
2. 点击 **Database**
3. 选择 **Replication** 标签

#### 2.2 启用表的 Realtime

找到以下表并启用 Realtime：

**必须启用的表**：
- ✅ `medications` - 药品数据表
- ✅ `medication_logs` - 服药记录表
- ✅ `user_settings` - 用户设置表
- ✅ `app_snapshots` - 应用快照表（可选）

**操作方法**：
1. 在表列表中找到对应的表
2. 点击表名右侧的开关按钮
3. 确认开关变为绿色（启用状态）

![Replication Settings](https://supabase.com/docs/img/realtime-replication.png)

---

### 步骤 3: 验证 Realtime 配置

#### 3.1 检查订阅状态

在浏览器控制台（F12）中查看日志：

```javascript
// 应该看到类似的日志
[Realtime] 初始化同步服务 { userId: "xxx", deviceId: "device_xxx" }
[Realtime] 订阅状态: SUBSCRIBED
🔗 Realtime 连接状态变更: connected
```

#### 3.2 测试多设备同步

**测试场景 1：添加药品**
1. 在设备 A 打开应用
2. 添加一个新药品
3. 在设备 B 观察（无需刷新）
4. ✅ 设备 B 应该自动显示新药品

**测试场景 2：删除药品**
1. 在设备 A 删除一个药品
2. 在设备 B 观察
3. ✅ 设备 B 应该自动移除该药品

**测试场景 3：服药记录**
1. 在设备 A 记录服药
2. 在设备 B 观察
3. ✅ 设备 B 应该自动显示新记录

---

## 🔧 故障排除

### 问题 1: 连接状态显示"未连接"

**可能原因**：
- Realtime 未启用
- 网络问题
- Supabase 项目配置错误

**解决方案**：
1. 确认已在 Supabase Dashboard 启用 Realtime
2. 检查浏览器控制台错误信息
3. 验证 Supabase URL 和 API Key 正确
4. 尝试点击"重新连接"按钮

### 问题 2: 数据不同步

**可能原因**：
- 表的 Realtime 未启用
- 过滤条件不正确
- WebSocket 连接被阻止

**解决方案**：
1. 确认所有必要的表都已启用 Realtime
2. 检查控制台是否有 Realtime 事件日志
3. 确认防火墙允许 WebSocket 连接
4. 尝试在无痕模式下测试

### 问题 3: 同步延迟过高

**可能原因**：
- 网络延迟
- 订阅过滤不够精确
- 数据量过大

**解决方案**：
1. 检查网络连接质量
2. 优化订阅过滤条件（使用 user_id）
3. 减少单次同步的数据量
4. 考虑使用分页加载

### 问题 4: 循环更新

**症状**：数据不断刷新，控制台日志重复

**解决方案**：
- ✅ 已实现：`isApplyingRemoteChange()` 防护
- 确保所有数据修改都检查此标志
- 检查是否有多个 Realtime 订阅

---

## 📊 性能优化

### 1. 订阅过滤

确保使用 `user_id` 过滤，只订阅当前用户的数据：

```typescript
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'medications',
  filter: `user_id=eq.${userId}`  // 关键！
}, handler)
```

### 2. 连接复用

使用单一 Channel 订阅多个表，避免创建多个连接：

```typescript
const channel = supabase
  .channel(`meds_sync_${deviceId}`)
  .on('postgres_changes', { table: 'medications' }, handler1)
  .on('postgres_changes', { table: 'medication_logs' }, handler2)
  .subscribe();
```

### 3. 防抖处理

对于频繁的数据变更，使用防抖避免过度刷新：

```typescript
let refreshTimer: NodeJS.Timeout;
const debouncedRefresh = () => {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => loadData(), 300);
};
```

---

## 🔐 安全配置

### Row Level Security (RLS)

迁移 SQL 已自动启用 RLS，确保用户只能访问自己的数据。

**验证 RLS 策略**：

```sql
-- 查看现有策略
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename IN ('medications', 'medication_logs', 'user_settings');
```

**测试 RLS**：
1. 使用不同用户登录
2. 确认只能看到自己的数据
3. 尝试访问其他用户数据（应该失败）

---

## 📈 监控与调试

### 1. 连接状态监控

应用右上角显示同步状态指示器：
- 🟢 **已连接** - Realtime 正常工作
- 🔵 **连接中** - 正在建立连接
- 🔴 **未连接** - 连接失败或断开

### 2. 控制台日志

启用详细日志以调试问题：

```typescript
// 在 realtime.ts 中已包含详细日志
console.log('[Realtime] 药品变更', payload);
console.log('[Realtime] 订阅状态:', status);
```

### 3. Supabase Dashboard 监控

在 Supabase Dashboard 查看：
- **Logs** → Realtime logs
- **API** → Realtime connections
- **Database** → Active queries

---

## 🎯 最佳实践

### 1. 启动时初始化

确保在用户登录后立即初始化 Realtime：

```typescript
useEffect(() => {
  if (!isLoggedIn) return;
  
  // 初始化 Realtime
  initRealtimeSync({ ... });
}, [isLoggedIn]);
```

### 2. 清理连接

组件卸载时清理 Realtime 连接：

```typescript
return () => {
  if (cleanupRealtime) cleanupRealtime();
};
```

### 3. 错误处理

实现自动重连机制：

```typescript
.subscribe((status) => {
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    setTimeout(() => reconnect(), 5000);
  }
});
```

### 4. 用户反馈

显示友好的同步提示：

```typescript
// 数据同步成功后显示提示
const notification = document.createElement('div');
notification.textContent = '✅ 数据已同步';
document.body.appendChild(notification);
```

---

## 📚 相关文档

- [Supabase Realtime 官方文档](https://supabase.com/docs/guides/realtime)
- [Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

## ✅ 检查清单

在部署前确认以下项目：

- [ ] 已执行 `supabase-realtime-migration.sql`
- [ ] 已在 Supabase Dashboard 启用表的 Realtime
- [ ] 已测试多设备同步功能
- [ ] 连接状态指示器正常工作
- [ ] 同步延迟 < 2 秒
- [ ] RLS 策略正确配置
- [ ] 错误日志正常输出
- [ ] 自动重连机制工作正常

---

## 🎉 完成

恭喜！你已成功配置 Supabase Realtime 多设备同步功能。

现在你的应用支持：
- ✅ 多设备实时数据同步
- ✅ 秒级数据更新
- ✅ 自动冲突解决
- ✅ 连接状态监控
- ✅ 用户数据隔离

---

**文档版本**: v1.0  
**最后更新**: 2025-01-02  
**适用版本**: Meds V251219.42+

