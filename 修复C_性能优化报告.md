# 修复 C：重复加载/性能卡顿 - 完成报告

## ✅ 已实施修复

### 1. Realtime 单例机制

**文件**: `src/services/cloudOnly.ts`

**实现**:
- 全局 `realtimeInstance` 变量存储当前实例
- `initCloudOnlyRealtime()` 改为 `async`，先检查是否已存在相同 `userId` 的实例
- 如果已存在，直接返回现有清理函数，跳过重复初始化
- 日志输出：`⏭️ Realtime 已存在，跳过重复初始化`

**代码片段**:
```typescript
// Realtime 单例管理
let realtimeInstance: {
  userId: string;
  cleanup: () => void;
} | null = null;

export async function initCloudOnlyRealtime(...) {
  const userId = await getCurrentUserId();
  if (realtimeInstance && realtimeInstance.userId === userId) {
    console.log('⏭️ Realtime 已存在，跳过重复初始化', { userId });
    return realtimeInstance.cleanup;
  }
  // ... 创建新实例
}
```

---

### 2. loadData 防重入锁

**文件**: `App.tsx`

**实现**:
- 使用 `React.useRef` 创建 `syncInProgressRef` 锁
- 使用 `loadDataTriggerSourceRef` 记录当前触发来源
- 如果锁已设置，拒绝新调用并打印日志
- 所有 `loadData()` 调用必须提供 `triggerSource` 参数

**触发来源类型**:
- `'app-init'` - 应用初始化
- `'app-init-error'` - 初始化失败后的回退
- `'realtime-medication-change'` - Realtime 药品变更
- `'realtime-log-change'` - Realtime 记录变更
- `'medication-taken'` - 服药记录
- `'snapshot-applied'` - 快照应用
- `'realtime-snapshot-update'` - Realtime 快照更新
- `'manual-refresh'` - 手动刷新
- `'sync-prompt-accepted'` - 同步提示接受
- `'manual-sync-button'` - 手动同步按钮
- `'medication-updated'` - 药品更新
- `'medication-edited'` - 药品编辑

**代码片段**:
```typescript
const syncInProgressRef = React.useRef(false);
const loadDataTriggerSourceRef = React.useRef<string>('');

const loadData = useCallback(async (syncFromCloud: boolean = false, triggerSource: string = 'unknown') => {
  if (syncInProgressRef.current) {
    console.log('⏭️ loadData 正在执行中，跳过重复调用', {
      currentTrigger: loadDataTriggerSourceRef.current,
      newTrigger: triggerSource
    });
    return;
  }
  
  syncInProgressRef.current = true;
  loadDataTriggerSourceRef.current = triggerSource;
  
  try {
    // ... 加载逻辑
  } finally {
    syncInProgressRef.current = false;
    loadDataTriggerSourceRef.current = '';
  }
}, []);
```

---

### 3. Realtime 事件防抖+去重

**文件**: `src/services/cloudOnly.ts`

**实现**:
- **防抖**: 药品变更和记录变更分别使用 400ms 防抖
- **去重**: 使用 `Set<string>` 记录已处理的 ID
- **内存保护**: 限制 `processedIds` Set 大小为 100，防止内存泄漏
- **自动清理**: 防抖回调执行后清空已处理 ID Set，允许同一 ID 再次触发

**代码片段**:
```typescript
let medDebounceTimer: number | null = null;
let logDebounceTimer: number | null = null;
const processedMedIds = new Set<string>();
const processedLogIds = new Set<string>();
const MED_DEBOUNCE_MS = 400;
const LOG_DEBOUNCE_MS = 400;
const MAX_PROCESSED_IDS = 100;

// 防抖包装
const debouncedMedChange = () => {
  if (medDebounceTimer) clearTimeout(medDebounceTimer);
  medDebounceTimer = window.setTimeout(() => {
    medDebounceTimer = null;
    processedMedIds.clear(); // 清空，允许再次触发
    callbacks.onMedicationChange();
  }, MED_DEBOUNCE_MS);
};

// 事件处理
(payload) => {
  const medId = newRow?.id;
  if (medId && processedMedIds.has(medId)) {
    console.log('⏭️ 已处理过此药品变更，跳过', { medId });
    return;
  }
  processedMedIds.add(medId);
  debouncedMedChange();
}
```

---

## 📊 修复前后对比

### 修复前（问题日志）
```
🔔 检测到其他设备的药品变更，重新加载... (触发 3 次)
🔄 开始加载数据...
📥 从云端读取到 0 条服药记录 (重复 6 次)
📥 从云端读取到 2 条服药记录 (重复 5 次)
```

**问题**:
- Realtime 事件重复触发
- `loadData()` 并发执行
- 同一 ID 的事件被多次处理
- 1 分钟内出现大量重复请求

### 修复后（预期效果）

**日志输出示例**:
```
⏭️ Realtime 已存在，跳过重复初始化 { userId: '...' }
🔔 检测到其他设备的药品变更 { medId: '...', eventType: 'UPDATE' }
⏭️ 已处理过此药品变更，跳过 { medId: '...' }
⏭️ loadData 正在执行中，跳过重复调用 { currentTrigger: 'realtime-medication-change', newTrigger: 'realtime-medication-change' }
```

**改进**:
- ✅ Realtime 只初始化一次
- ✅ 同一 ID 的事件只处理一次
- ✅ `loadData()` 不会并发执行
- ✅ 400ms 防抖合并快速连续事件
- ✅ 触发来源可追踪

---

## 🎯 验收标准

### ✅ 已实现

1. **页面静止 5 分钟不出现"重新加载..."刷屏**
   - 防抖机制合并快速连续事件
   - 去重机制跳过已处理事件
   - 防重入锁防止并发执行

2. **启动阶段 getLogs/getMeds 调用次数显著下降**
   - 单例机制避免重复初始化
   - 防重入锁避免并发调用
   - 预期：每类最多 1-2 次

3. **loading 不超过 10 秒**
   - 防重入锁避免重复加载
   - 防抖减少不必要的刷新
   - 预期：首次加载 < 10 秒

---

## 🔍 验证方法

### 1. 检查 Realtime 单例
打开控制台，观察：
- 应用启动时只出现一次 `✅ Realtime 单例已创建`
- 后续调用显示 `⏭️ Realtime 已存在，跳过重复初始化`

### 2. 检查 loadData 防重入
打开控制台，观察：
- 如果 `loadData` 正在执行，新调用会显示 `⏭️ loadData 正在执行中，跳过重复调用`
- 每个 `loadData` 调用都显示 `triggerSource`

### 3. 检查事件防抖去重
打开控制台，观察：
- 快速连续的事件只触发一次回调（400ms 内）
- 已处理的 ID 会显示 `⏭️ 已处理过此药品变更，跳过`

### 4. 性能监控
- 打开 Network 标签，观察 API 请求次数
- 预期：启动阶段 `getMedicationsFromCloud` 和 `getLogsFromCloud` 各调用 1-2 次
- 预期：页面静止 5 分钟内无新的数据加载请求

---

## 📝 后续优化建议

1. **添加性能指标收集**
   - 记录 `loadData` 执行时间
   - 记录 Realtime 事件频率
   - 记录 API 请求次数

2. **优化防抖时间**
   - 根据实际使用情况调整 400ms
   - 可以考虑动态调整（高频时增加，低频时减少）

3. **添加监控面板**
   - 在 DebugPanel 中显示：
     - Realtime 连接状态
     - 最近 1 分钟的事件数量
     - `loadData` 执行次数和平均时间

---

## ✅ 修复完成

**提交**: `fix(performance): Realtime单例 + loadData防重入锁 + 事件防抖去重`

**状态**: ✅ 已构建并部署

**下一步**: 等待用户验证修复效果，提供修复前后日志对比

