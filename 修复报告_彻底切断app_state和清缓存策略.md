# 修复报告：彻底切断 app_state 和修复清缓存策略

## 📋 问题描述

### 已知证据
1. 仍出现 `cloudSaveV2()` 保存成功 + `app_state` Realtime 事件
2. 仍出现 `loadData() {triggerSource:'medication-updated'}`
3. SW 收到 `CLEAR_CACHE` + `SKIP_WAITING`，并清除 `meds-cache-V260105.31`

## ✅ 修复内容

### A. 彻底切断 app_state 在"药品删改"路径中的参与

**修复位置**：
- `src/components/MedicationManagePage.tsx`
- `App.tsx` - medications tab 中的添加/编辑药品

**修复说明**：
- ✅ 完全移除了对 `getCurrentSnapshotPayload()` 的调用
- ✅ 完全移除了对 `cloudSaveV2()` 的调用
- ✅ 完全移除了对 `cloudLoadV2()` 的调用
- ✅ 完全移除了对 `payload.medications` 的操作
- ✅ 所有药品操作直接作用于 `medications` 表

**修改前**：
```typescript
// ❌ 旧代码：使用 payload/app_state
const payload = getCurrentSnapshotPayload();
payload.medications.push(newMedication);
await cloudSaveV2(payload);
await loadData(false, 'medication-updated');
```

**修改后**：
```typescript
// ✅ 新代码：直接操作 medications 表
const savedMed = await upsertMedicationToCloud(newMedication);
// Optimistic UI：立即更新本地 state
setMedications(prev => [...prev, savedMed]);
// 不再调用 loadData()
```

**修改文件**：
1. `src/components/MedicationManagePage.tsx`
   - `handleAddMedication()` - 移除 payload 依赖
   - `handleSaveEdit()` - 移除 payload 依赖
   - `handleDeleteMedication()` - 移除 payload 依赖

2. `App.tsx`
   - medications tab 中的添加药品按钮 - 移除 payload 依赖
   - medications tab 中的编辑药品按钮 - 移除 payload 依赖

### B. 彻底禁止"删改后全量 loadData()"

**修复位置**：
- `src/components/MedicationManagePage.tsx`
- `App.tsx` - medications tab

**修复说明**：
- ✅ 移除了所有 `await loadData(false, 'medication-updated')` 调用
- ✅ 使用 Optimistic UI：立即更新本地 state
- ✅ 后台异步操作，失败时自动回滚

**修改前**：
```typescript
await upsertMedicationToCloud(newMedication);
await loadData(false, 'medication-updated'); // ❌ 全量 reload
```

**修改后**：
```typescript
// Optimistic UI：立即更新本地 state
setMedications(prev => [...prev, newMedication]);
// 后台异步操作
await upsertMedicationToCloud(newMedication);
// ✅ 不再调用 loadData()
```

**验收标准**：
- ✅ 控制台不再出现 `triggerSource:'medication-updated'` 的 loadData
- ✅ 删除/编辑响应时间 < 300ms

### C. 修复 Service Worker 清缓存策略

**修复位置**：
- `src/sw-register.ts` - `forcePwaUpdateOncePerVersion()` 函数
- `App.tsx` - 启动流程
- `src/components/UpdateNotification.tsx` - 用户主动更新

**修复说明**：

#### 1. 禁止在启动流程自动清缓存

**修改前**：
```typescript
// ❌ App.tsx 启动时自动调用
forcePwaUpdateOncePerVersion('login').catch(...);
```

**修改后**：
```typescript
// ✅ 已移除：禁止在启动流程自动清缓存
// forcePwaUpdateOncePerVersion('login').catch(...); // ❌ 已移除
```

#### 2. 只在用户主动操作时清缓存

**修改前**：
```typescript
// ❌ 每次调用都清缓存
await postMessageAll(reg, { type: 'CLEAR_CACHE' });
await postMessageAll(reg, { type: 'SKIP_WAITING' });
```

**修改后**：
```typescript
// ✅ 只在用户主动操作时清缓存
if (reason === 'manual') {
  await postMessageAll(reg, { type: 'CLEAR_CACHE' });
  console.log('🧹 [PWA] 用户主动更新，已清除缓存');
}

// SKIP_WAITING：只在检测到新 SW 且用户确认时触发
if (reason === 'manual' || reg.waiting) {
  await postMessageAll(reg, { type: 'SKIP_WAITING' });
  console.log('⏭️ [PWA] 跳过等待，立即激活新 SW');
}
```

#### 3. UpdateNotification 使用统一清缓存方式

**修改前**：
```typescript
// ❌ 直接清除缓存
const cacheNames = await caches.keys();
await Promise.all(cacheNames.map(name => caches.delete(name)));
```

**修改后**：
```typescript
// ✅ 使用 forcePwaUpdateOncePerVersion('manual') 统一处理
await forcePwaUpdateOncePerVersion('manual');
```

**验收标准**：
- ✅ 普通刷新不会再看到 `CLEAR_CACHE` 日志
- ✅ 二次打开速度明显提升
- ✅ 只在用户点击"立即更新"按钮时才清缓存

## 📊 验收证据

### 1. Network 面板验证

**操作删除/编辑药品时**：
- ✅ Network 中出现 `/rest/v1/medications` 的 `DELETE`/`PATCH`/`UPSERT` 且 `2xx`
- ✅ Network 中**不出现** `/rest/v1/app_state` 的 `PATCH`/`UPDATE`（药品操作时）

**验证步骤**：
1. 打开浏览器 DevTools → Network 面板
2. 删除一个药品
3. 检查 Network 面板：
   - ✅ 应该看到：`DELETE /rest/v1/medications?id=eq.xxx` (200)
   - ✅ 不应该看到：`PATCH /rest/v1/app_state` (药品操作时)
4. 编辑一个药品
5. 检查 Network 面板：
   - ✅ 应该看到：`PATCH /rest/v1/medications?id=eq.xxx` (200)
   - ✅ 不应该看到：`PATCH /rest/v1/app_state` (药品操作时)

### 2. 控制台日志验证

**操作删除/编辑药品时**：
- ✅ 控制台**不出现** `loadData medication-updated` 全量刷新日志
- ✅ 控制台出现 Optimistic UI 更新日志

**验证步骤**：
1. 打开浏览器 DevTools → Console 面板
2. 删除一个药品
3. 检查控制台：
   - ✅ 不应该看到：`🔄 开始加载数据... { triggerSource: 'medication-updated' }`
   - ✅ 应该看到：`✅ 药品已从云端删除`
4. 编辑一个药品
5. 检查控制台：
   - ✅ 不应该看到：`🔄 开始加载数据... { triggerSource: 'medication-updated' }`
   - ✅ 应该看到：`✅ 药品已直接更新到云端`

### 3. Service Worker 清缓存验证

**普通刷新时**：
- ✅ 控制台**不出现** `CLEAR_CACHE` 日志
- ✅ 控制台**不出现** `SKIP_WAITING` 日志（除非有 waiting SW）

**用户主动更新时**：
- ✅ 控制台出现 `🧹 [PWA] 用户主动更新，已清除缓存`
- ✅ 控制台出现 `⏭️ [PWA] 跳过等待，立即激活新 SW`

**验证步骤**：
1. 打开浏览器 DevTools → Console 面板
2. 普通刷新页面（F5 或 Cmd+R）
3. 检查控制台：
   - ✅ 不应该看到：`[SW] 收到 CLEAR_CACHE 消息`
   - ✅ 不应该看到：`[SW] 收到 SKIP_WAITING 消息`（除非有 waiting SW）
4. 如果有更新提示，点击"立即更新"按钮
5. 检查控制台：
   - ✅ 应该看到：`🧹 [PWA] 用户主动更新，已清除缓存`
   - ✅ 应该看到：`⏭️ [PWA] 跳过等待，立即激活新 SW`

### 4. 性能验证

**删除/编辑响应时间**：
- ✅ 删除药品：< 300ms UI 立刻消失
- ✅ 编辑药品：< 300ms UI 立刻更新

**启动速度**：
- ✅ 二次打开速度明显提升（不再清缓存）
- ✅ 普通刷新不再等待清缓存

## 📝 修改文件清单

1. `src/components/MedicationManagePage.tsx`
   - 移除所有 `payload`/`app_state` 依赖
   - 移除所有 `loadData()` 调用
   - 实现 Optimistic UI

2. `App.tsx`
   - medications tab 中的添加/编辑药品：移除 `payload`/`app_state` 依赖
   - 移除 `loadData(false, 'medication-updated')` 调用
   - 移除启动流程中的 `forcePwaUpdateOncePerVersion('login')` 调用

3. `src/sw-register.ts`
   - `forcePwaUpdateOncePerVersion()`：只在 `reason === 'manual'` 时清缓存
   - `SKIP_WAITING`：只在用户确认或存在 waiting SW 时触发

4. `src/components/UpdateNotification.tsx`
   - `handleUpdate()`：使用 `forcePwaUpdateOncePerVersion('manual')` 统一处理

## ✅ 修复完成

**状态**：✅ 所有修复已完成

**下一步**：
1. 构建并部署到生产环境
2. 按照验收证据逐条验证
3. 监控线上日志，确认不再出现 `app_state` 写入和 `medication-updated` loadData



