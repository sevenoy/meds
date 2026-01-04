# 前端 UI 功能说明文档

## 📋 目录

1. [整体布局](#整体布局)
2. [主页面组件](#主页面组件)
3. [药品管理功能](#药品管理功能)
4. [服药记录功能](#服药记录功能)
5. [数据可视化](#数据可视化)
6. [API 接口需求](#api-接口需求)

---

## 整体布局

### 页面结构

```
MainApp (主应用容器)
├── Header (顶部导航栏)
│   ├── 标题: "药盒助手"
│   └── 登出按钮
│
└── Main (主内容区)
    ├── TODAY 标题
    ├── 同步状态指示器
    ├── 进度和历史区域 (网格布局)
    │   ├── 今日进度卡片 (左侧)
    │   └── 最近7天记录卡片 (右侧)
    └── 药品列表区域
        ├── 标题和添加按钮
        └── 药品卡片网格
```

### 文件位置
- `frontend/src/components/MainApp.tsx` - 主应用容器

---

## 主页面组件

### 1. Header (顶部导航栏)

**文件**: `frontend/src/components/MainApp.tsx` (第 37-50 行)

**UI 元素**:
- **标题**: "药盒助手" (左侧)
- **登出按钮**: 带图标和文字 (右侧)

**功能**:
- 显示应用名称
- 提供登出功能（清除登录状态）

**API 需求**: 
- `POST /api/auth/logout` - 登出接口

---

### 2. TODAY 标题

**文件**: `frontend/src/components/MainApp.tsx` (第 53-56 行)

**UI 元素**:
- 巨大的斜体标题 "TODAY"
- 字体: `text-6xl md:text-8xl font-black italic`

**功能**:
- 视觉标识，强调"今日"概念
- 响应式字体大小

**API 需求**: 无

---

### 3. 同步状态指示器

**文件**: `frontend/src/components/SyncStatusIndicator.tsx`

**UI 元素**:
- 状态图标（绿色勾号/旋转图标/红色叉号）
- 状态文字（"已同步" / "同步中..." / "同步失败"）
- 最后同步时间

**功能**:
- 显示数据同步状态
- 实时更新同步状态
- 显示最后同步时间

**状态类型**:
- `synced` - 已同步（绿色）
- `syncing` - 同步中（蓝色，旋转动画）
- `error` - 同步失败（红色）

**API 需求**:
- `GET /api/sync/status` - 获取同步状态
- WebSocket 连接 - 实时同步状态更新

---

## 药品管理功能

### 4. 药品列表区域

**文件**: `frontend/src/components/MedicationList.tsx`

**UI 元素**:
- **标题**: "今日药品"
- **添加按钮**: 带 "+" 图标和"添加药品"文字
- **药品卡片网格**: 响应式布局（移动端1列，平板2列，桌面3列）

**功能**:
- 显示所有药品列表
- 提供添加药品入口
- 响应式布局适配不同屏幕

**API 需求**:
- `GET /api/medications` - 获取药品列表

---

### 5. 药品卡片

**文件**: `frontend/src/components/MedicationList.tsx` (第 50-89 行)

**UI 元素**:
- **颜色标识**: 左侧圆形色块（根据 `accent` 字段）
- **药品名称**: 大字体显示
- **剂量信息**: "剂量: X"
- **服药时间**: 带时钟图标，显示 `scheduled_time`
- **操作按钮**:
  - 拍照记录（主要按钮，黑色背景）
  - 编辑按钮（铅笔图标）
  - 删除按钮（垃圾桶图标，红色边框）

**功能**:
- 展示药品基本信息
- 提供快速操作入口
- 视觉区分（颜色主题）

**交互**:
- 点击"拍照记录" → 打开拍照模态框
- 点击"编辑" → 打开编辑模态框
- 点击"删除" → 确认后删除药品

**API 需求**:
- `GET /api/medications/:id` - 获取单个药品详情
- `PUT /api/medications/:id` - 更新药品
- `DELETE /api/medications/:id` - 删除药品

---

### 6. 添加/编辑药品模态框

**文件**: `frontend/src/components/AddMedicationModal.tsx`

**UI 元素**:
- **标题**: "添加药品" 或 "编辑药品"
- **关闭按钮**: 右上角 X 图标
- **表单字段**:
  1. 药品名称（必填，文本输入）
  2. 剂量（必填，文本输入，如 "1片"）
  3. 服药时间（必填，时间选择器，HH:mm 格式）
  4. 颜色主题（6种颜色选择）
- **操作按钮**:
  - 取消按钮（左侧）
  - 保存/更新按钮（右侧，黑色背景）

**功能**:
- 添加新药品
- 编辑已有药品信息
- 选择颜色主题
- 设置服药时间

**表单验证**:
- 药品名称必填
- 剂量必填
- 服药时间必填（格式：HH:mm）
- 颜色主题默认 "lime"

**颜色选项**:
- `lime` - 青柠（绿色）
- `berry` - 浆果（粉色）
- `mint` - 薄荷（青色）
- `blue` - 蓝色
- `purple` - 紫色
- `orange` - 橙色

**API 需求**:
- `POST /api/medications` - 创建药品
  - 请求体: `{ name, dosage, scheduled_time, accent }`
  - 响应: `{ success: true, data: Medication }`
- `PUT /api/medications/:id` - 更新药品
  - 请求体: `{ name, dosage, scheduled_time, accent }`
  - 响应: `{ success: true, data: Medication }`

**数据模型**:
```typescript
interface Medication {
  id: string;                    // UUID（创建时生成）
  name: string;                  // 药品名称
  dosage: string;                // 剂量
  scheduled_time: string;        // HH:mm 格式
  accent?: string;               // 颜色主题
  created_at?: string;           // ISO 8601
  updated_at?: string;           // ISO 8601
}
```

---

## 服药记录功能

### 7. 拍照记录模态框

**文件**: `frontend/src/components/CameraModal.tsx`

**UI 元素**:
- **标题**: "记录 [药品名称]" 或 "拍照记录"
- **关闭按钮**: 右上角 X 图标
- **摄像头预览**: 视频流显示区域
- **拍照按钮**: 带相机图标，黑色背景
- **照片预览**: 拍摄后的照片显示
- **时间信息**: 显示拍摄时间和时间来源
- **操作按钮**:
  - 重拍按钮（左侧）
  - 确认按钮（右侧，带勾号图标）

**功能**:
- 调用设备摄像头
- 实时视频预览
- 拍照并捕获图像
- 显示拍摄时间
- 确认保存记录

**交互流程**:
1. 打开模态框 → 请求摄像头权限
2. 显示视频预览
3. 点击"拍照" → 捕获图像
4. 显示照片预览和时间信息
5. 点击"确认" → 保存记录
6. 点击"重拍" → 返回拍照界面

**时间来源**:
- `exif` - 从照片 EXIF 数据提取（最可信）
- `system` - 系统当前时间（次可信）
- `manual` - 用户手动输入（最不可信）

**API 需求**:
- `POST /api/logs` - 创建服药记录
  - 请求体: 
    ```json
    {
      "medication_id": "uuid",
      "image_data": "base64_dataurl",
      "taken_at": "2026-01-03T09:00:00Z",
      "time_source": "system",
      "image_hash": "sha256_hash"
    }
    ```
  - 响应: `{ success: true, data: MedicationLog }`

**数据模型**:
```typescript
interface MedicationLog {
  id: string;                    // UUID
  medication_id: string;          // 关联药品 ID
  taken_at: string;               // ISO 8601
  uploaded_at: string;            // ISO 8601
  time_source: 'exif' | 'system' | 'manual';
  status: 'ontime' | 'late' | 'manual' | 'suspect';
  image_path?: string;            // 照片路径或 DataURL
  image_hash?: string;            // SHA-256 哈希
  created_at?: string;
  updated_at?: string;
}
```

---

## 数据可视化

### 8. 今日进度卡片

**文件**: `frontend/src/components/TodayProgress.tsx`

**UI 元素**:
- **标题**: "今日进度"
- **环形进度图**: SVG 绘制的圆形进度条
  - 背景圆（灰色）
  - 进度圆（绿色，根据百分比填充）
  - 中心百分比数字（大字体）
- **统计文字**: "已完成 X / Y 个药品"

**功能**:
- 显示今日服药完成率
- 视觉化进度展示
- 实时更新进度

**计算逻辑**:
1. 获取所有药品列表
2. 获取今日所有服药记录
3. 统计已服用的药品（去重）
4. 计算百分比: `(已服用数量 / 总药品数量) * 100`

**API 需求**:
- `GET /api/medications` - 获取药品列表
- `GET /api/logs?date=today` - 获取今日记录
  - 查询参数: `date=2026-01-03` (可选，默认今天)

**数据格式**:
- 输入: 药品列表 + 今日记录列表
- 输出: 百分比数字 (0-100)

---

### 9. 最近7天记录卡片

**文件**: `frontend/src/components/LogHistory.tsx`

**UI 元素**:
- **标题**: "最近7天记录"
- **记录列表**: 垂直排列的记录项
- **每条记录包含**:
  - 照片缩略图（左侧，64x64px）
  - 药品名称（大字体）
  - 状态图标（按时/延迟）
  - 服药时间（带时钟图标）
  - 状态文字（按时/延迟/手动）
  - 日期文字（今天/昨天/具体日期）

**功能**:
- 显示最近7天的服药记录
- 照片预览
- 状态标识
- 时间格式化显示

**状态显示**:
- `ontime` - 绿色勾号图标 + "按时"
- `late` - 橙色警告图标 + "延迟"
- `manual` - 灰色时钟图标 + "手动"

**空状态**:
- 显示提示文字："还没有服药记录"
- 提示操作："点击药品卡片上的'拍照记录'按钮开始记录"

**API 需求**:
- `GET /api/logs?days=7` - 获取最近7天记录
  - 查询参数: `days=7` (可选，默认7)
  - 响应: `{ success: true, data: MedicationLog[] }`

**数据格式**:
```typescript
interface LogWithMedication extends MedicationLog {
  medicationName?: string;  // 关联的药品名称
}
```

---

## API 接口需求总结

### 认证相关
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/me` - 获取当前用户信息

### 药品管理
- `GET /api/medications` - 获取药品列表
  - 响应: `{ success: true, data: Medication[] }`
- `GET /api/medications/:id` - 获取单个药品
  - 响应: `{ success: true, data: Medication }`
- `POST /api/medications` - 创建药品
  - 请求体: `{ name, dosage, scheduled_time, accent }`
  - 响应: `{ success: true, data: Medication }`
- `PUT /api/medications/:id` - 更新药品
  - 请求体: `{ name, dosage, scheduled_time, accent }`
  - 响应: `{ success: true, data: Medication }`
- `DELETE /api/medications/:id` - 删除药品
  - 响应: `{ success: true, message: "删除成功" }`

### 服药记录
- `GET /api/logs` - 获取记录列表
  - 查询参数: 
    - `medication_id` (可选) - 筛选特定药品
    - `days` (可选) - 最近N天，默认全部
    - `date` (可选) - 特定日期，格式 YYYY-MM-DD
  - 响应: `{ success: true, data: MedicationLog[] }`
- `POST /api/logs` - 创建记录
  - 请求体: 
    ```json
    {
      "medication_id": "uuid",
      "image_data": "data:image/jpeg;base64,...",
      "taken_at": "2026-01-03T09:00:00Z",
      "time_source": "system",
      "image_hash": "sha256_hash"
    }
    ```
  - 响应: `{ success: true, data: MedicationLog }`
- `GET /api/logs/:id` - 获取单个记录
  - 响应: `{ success: true, data: MedicationLog }`
- `DELETE /api/logs/:id` - 删除记录
  - 响应: `{ success: true, message: "删除成功" }`

### 同步相关
- `GET /api/sync/status` - 获取同步状态
  - 响应: 
    ```json
    {
      "success": true,
      "data": {
        "status": "synced" | "syncing" | "error",
        "lastSyncTime": "2026-01-03T09:00:00Z",
        "pendingCount": 0
      }
    }
    ```
- `POST /api/sync/push` - 推送本地变更
  - 响应: `{ success: true, synced: 5 }`
- `POST /api/sync/pull` - 拉取远程变更
  - 响应: `{ success: true, updated: 3 }`

### 统计相关
- `GET /api/stats/today` - 获取今日统计
  - 响应: 
    ```json
    {
      "success": true,
      "data": {
        "total": 5,
        "completed": 3,
        "percentage": 60
      }
    }
    ```
- `GET /api/stats/week` - 获取本周统计
- `GET /api/stats/month` - 获取本月统计

---

## 数据流说明

### 添加药品流程
```
用户点击"添加药品"
  ↓
打开 AddMedicationModal
  ↓
填写表单信息
  ↓
点击"添加"按钮
  ↓
调用 POST /api/medications
  ↓
保存到本地 IndexedDB
  ↓
更新 UI，显示新药品
```

### 拍照记录流程
```
用户点击"拍照记录"
  ↓
打开 CameraModal
  ↓
请求摄像头权限
  ↓
显示视频预览
  ↓
点击"拍照"
  ↓
捕获图像（Canvas）
  ↓
显示照片预览
  ↓
点击"确认"
  ↓
调用 POST /api/logs
  ↓
保存到本地 IndexedDB
  ↓
更新进度和历史记录
```

### 进度计算流程
```
组件挂载
  ↓
调用 GET /api/medications
  ↓
调用 GET /api/logs?date=today
  ↓
统计已服用的药品（去重）
  ↓
计算百分比
  ↓
更新环形进度图
```

---

## 前端存储说明

### IndexedDB 表结构

**medications 表**:
- 存储所有药品数据
- 索引: `id`, `user_id`, `scheduled_time`

**medicationLogs 表**:
- 存储所有服药记录
- 索引: `id`, `medication_id`, `user_id`, `taken_at`
- 复合索引: `[medication_id+taken_at]`

### 同步策略

1. **读取**: 优先从本地 IndexedDB 读取，然后尝试从 API 同步
2. **写入**: 先保存到本地，标记为 `sync_state: 'dirty'`，然后异步同步到 API
3. **离线**: 完全离线可用，数据存储在本地
4. **在线**: 自动同步本地变更到服务器

---

## 错误处理

### 网络错误
- 显示错误提示
- 数据保存在本地，等待网络恢复后同步

### 权限错误
- 摄像头权限被拒绝 → 显示提示信息
- 数据访问权限错误 → 显示错误消息

### 验证错误
- 表单验证失败 → 显示字段错误
- API 验证失败 → 显示服务器错误消息

---

## 响应式设计

### 断点
- **移动端**: < 768px (1列布局)
- **平板**: 768px - 1024px (2列布局)
- **桌面**: > 1024px (3列布局)

### 适配元素
- 药品卡片网格
- 进度和历史区域
- 模态框大小
- 字体大小

---

## 待实现功能

### 前端待完善
- [ ] EXIF 时间提取（从文件上传）
- [ ] 照片上传到云端 Storage
- [ ] 实时同步状态更新
- [ ] 离线队列管理
- [ ] 冲突解决 UI

### 后端需要实现
- [ ] 所有 API 接口
- [ ] 认证中间件
- [ ] 数据验证
- [ ] 文件上传处理
- [ ] 实时同步 WebSocket
- [ ] 统计计算

---

**文档版本**: 1.0  
**最后更新**: 2026-01-03  
**适用版本**: V260103.01

