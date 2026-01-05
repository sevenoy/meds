# 修复 D：乐观锁冲突 PGRST116 - 完成报告

## ✅ 已实施修复

### 问题分析

**现象**:
```
PATCH app_state 带 version=eq.xx 时返回 0 rows
随后 single() 报错: Cannot coerce the result to a single JSON object (PGRST116)
```

**根因**:
- UPDATE 操作使用乐观锁条件（`owner_id + version`）
- 当 version 不匹配时，UPDATE 返回 0 rows
- 代码使用 `.single()` 期望返回 1 行，0 rows 时触发 PGRST116 错误

**修复策略**:
1. 移除 `.single()`，使用数组返回
2. 检测 0 rows = 冲突，进入冲突处理分支
3. 冲突处理：重新加载最新数据，更新 version，重试一次
4. 重试仍失败：提示用户并停止

---

### 1. 移除 `.single()`，使用数组返回

**文件**: `src/services/snapshot.ts`

**修改前**:
```typescript
const { data: updatedState, error: updateError } = await supabase
  .from('app_state')
  .update({...})
  .eq('owner_id', userId)
  .eq('version', currentVersion)
  .select('id, payload, version, updated_at, updated_by')
  .single(); // ❌ 0 rows 时会报错 PGRST116
```

**修改后**:
```typescript
const { data: updatedStateArray, error: updateError } = await supabase
  .from('app_state')
  .update({...})
  .eq('owner_id', userId)
  .eq('version', currentVersion)
  .select('id, payload, version, updated_at, updated_by');
  // ✅ 不使用 .single()，返回数组

const updatedState = updatedStateArray && updatedStateArray.length > 0 
  ? updatedStateArray[0] 
  : null;
```

---

### 2. 冲突检测和处理

**实现**:
- 检测 `updatedState === null` 或 `updatedStateArray.length === 0` = 冲突
- 进入冲突处理分支（最多重试 1 次）
- 重新加载最新云端数据
- 更新 `currentVersion` 为最新值
- 使用"以当前编辑为准"的覆盖策略
- 重试 UPDATE 操作

**代码片段**:
```typescript
if (!updatedState) {
  // 冲突：version 不匹配
  console.warn(`⚠️ cloudSaveV2() 检测到冲突（尝试 ${retryCount + 1}/${maxRetries + 1}）`);
  
  if (retryCount < maxRetries) {
    // 重新加载最新数据
    const reloadResult = await cloudLoadV2();
    const newVersion = reloadResult.version || currentVersion;
    
    // 更新 version，使用当前 payload（以当前编辑为准）
    currentVersion = newVersion;
    retryCount++;
    continue; // 重试
  } else {
    // 重试失败，返回错误
    return { 
      success: false, 
      conflict: true, 
      message: '同步冲突，请稍后重试。云端数据已被其他设备修改。' 
    };
  }
}
```

---

### 3. 重试机制

**实现**:
- 最多重试 1 次（`maxRetries = 1`）
- 使用 `while` 循环实现重试逻辑
- 每次重试前重新加载最新数据
- 重试失败后停止，不再无限重试

**代码片段**:
```typescript
const maxRetries = 1; // 最多重试 1 次
let retryCount = 0;

while (retryCount <= maxRetries) {
  // ... UPDATE 操作
  
  if (!updatedState) {
    if (retryCount < maxRetries) {
      // 冲突处理 + 重试
      currentVersion = newVersion;
      retryCount++;
      continue;
    } else {
      // 重试失败
      return { success: false, conflict: true, message: '...' };
    }
  }
  
  // 成功
  return { success: true, ... };
}
```

---

## 📊 修复前后对比

### 修复前（问题日志）
```
💾 cloudSaveV2() 开始保存，userId: 53b1d982-29b2-44f8-ab61-3a36e434f591
📌 当前云端 version: 42
PATCH https://ptmgncjechjprxtndqon.supabase.co/rest/v1/app_state?owner_id=eq.53b1d982-29b2-44f8-ab61-3a36e434f591&version=eq.42&select=id%2Cpayload%2Cversion%2Cupdated_at%2Cupdated_by 406 (Not Acceptable)
❌ UPDATE 操作失败: {code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'Cannot coerce the result to a single JSON object'}
```

**问题**:
- ❌ PGRST116 错误
- ❌ 406 Not Acceptable
- ❌ 冲突未正确处理
- ❌ 用户看到错误但不知道如何处理

### 修复后（预期日志）

#### 场景 1：首次冲突，重试成功
```
💾 cloudSaveV2() 开始保存，userId: 53b1d982-29b2-44f8-ab61-3a36e434f591
📌 当前云端 version: 42
⚠️ cloudSaveV2() 检测到冲突（尝试 1/2）：version 不匹配，更新失败
🔄 重新加载最新云端数据以解决冲突...
🔄 cloudLoadV2() 开始读取，userId: 53b1d982-29b2-44f8-ab61-3a36e434f591
✅ cloudLoadV2() 读取成功: {version: 43, updated_at: '2025-12-20T12:36:35.831787+00:00', updated_by: 'device_xxx'}
📌 冲突解决：重新加载后 version 42 → 43
✅ cloudSaveV2() 保存成功: {version: 44, updated_at: '...', updated_by: 'device_xxx', retryCount: '重试 1 次'}
```

#### 场景 2：重试仍失败
```
💾 cloudSaveV2() 开始保存，userId: 53b1d982-29b2-44f8-ab61-3a36e434f591
📌 当前云端 version: 42
⚠️ cloudSaveV2() 检测到冲突（尝试 1/2）：version 不匹配，更新失败
🔄 重新加载最新云端数据以解决冲突...
📌 冲突解决：重新加载后 version 42 → 43
⚠️ cloudSaveV2() 检测到冲突（尝试 2/2）：version 不匹配，更新失败
❌ 冲突重试失败：已达到最大重试次数
返回: {success: false, conflict: true, message: '同步冲突，请稍后重试。云端数据已被其他设备修改。'}
```

**改进**:
- ✅ 无 PGRST116 错误
- ✅ 无 406 Not Acceptable
- ✅ 冲突被正确检测和处理
- ✅ 自动重试机制
- ✅ 友好的错误提示

---

## 🎯 验收标准

### ✅ 已实现

1. **UPDATE 仍用乐观锁条件**
   - ✅ 保持 `owner_id + version` 条件
   - ✅ 只有 version 匹配才更新

2. **0 rows 不调用 single()**
   - ✅ 移除 `.single()`，使用数组返回
   - ✅ 检测 `updatedState === null` = 冲突

3. **冲突处理分支**
   - ✅ 重新加载最新数据（`cloudLoadV2`）
   - ✅ 更新 `currentVersion` 为最新值
   - ✅ 使用"以当前编辑为准"的覆盖策略
   - ✅ 重试一次 UPDATE

4. **重试仍失败的处理**
   - ✅ 提示"同步冲突，请稍后重试"
   - ✅ 停止无限重试（最多 1 次）

---

## 🔍 验证方法

### 1. 检查日志输出

**成功场景**（首次冲突，重试成功）:
```
⚠️ cloudSaveV2() 检测到冲突（尝试 1/2）
🔄 重新加载最新云端数据以解决冲突...
📌 冲突解决：重新加载后 version X → Y
✅ cloudSaveV2() 保存成功: {retryCount: '重试 1 次'}
```

**失败场景**（重试仍失败）:
```
⚠️ cloudSaveV2() 检测到冲突（尝试 1/2）
🔄 重新加载最新云端数据以解决冲突...
⚠️ cloudSaveV2() 检测到冲突（尝试 2/2）
❌ 冲突重试失败：已达到最大重试次数
```

### 2. 检查错误日志

**不应该出现**:
- ❌ `PGRST116` 错误
- ❌ `Cannot coerce the result to a single JSON object`
- ❌ `406 (Not Acceptable)` 错误

**应该出现**:
- ✅ `⚠️ cloudSaveV2() 检测到冲突`
- ✅ `🔄 重新加载最新云端数据以解决冲突...`
- ✅ `同步冲突，请稍后重试`（如果重试失败）

### 3. 功能验证

1. **模拟冲突场景**:
   - 在两个设备上同时编辑同一药品
   - 观察日志输出
   - 确认冲突被正确处理

2. **检查数据一致性**:
   - 冲突处理后，数据应该正确保存
   - 版本号应该正确递增

---

## 📝 相关代码位置

### 1. `cloudSaveV2()` 冲突处理
**文件**: `src/services/snapshot.ts`  
**行数**: 315-395  
**关键代码**:
```typescript
// 移除 .single()，使用数组返回
const { data: updatedStateArray, error: updateError } = await supabase
  .from('app_state')
  .update({...})
  .eq('owner_id', userId)
  .eq('version', currentVersion)
  .select('id, payload, version, updated_at, updated_by');

const updatedState = updatedStateArray && updatedStateArray.length > 0 
  ? updatedStateArray[0] 
  : null;

if (!updatedState) {
  // 冲突处理：重新加载 + 重试
  const reloadResult = await cloudLoadV2();
  currentVersion = reloadResult.version || currentVersion;
  retryCount++;
  continue;
}
```

---

## ✅ 修复完成

**提交**: `fix(optimistic-lock): 正确处理 PGRST116 冲突，支持自动重试`

**状态**: ✅ 已构建并部署

**下一步**: 
1. 等待 GitHub Pages 部署完成
2. 刷新浏览器验证修复效果
3. 确认不再出现 PGRST116 错误
4. 确认冲突被正确处理（日志输出）

**冲突处理策略**: 
- 当前实现：**"以当前编辑为准"**（覆盖策略）
- 如需合并策略，可在冲突处理分支中实现 payload 合并逻辑

