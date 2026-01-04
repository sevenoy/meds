# 后端 API 需求文档

## 📋 概述

本文档详细说明了前端所需的所有后端 API 接口。后端需要实现这些接口以支持前端功能。

## 🔐 认证相关

### 1. 用户登录
```
POST /api/auth/login
Content-Type: application/json

请求体:
{
  "email": "user@example.com",
  "password": "password123"
}

响应:
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com"
    },
    "token": "jwt_token"
  }
}
```

### 2. 用户登出
```
POST /api/auth/logout
Authorization: Bearer {token}

响应:
{
  "success": true,
  "message": "登出成功"
}
```

### 3. 获取当前用户
```
GET /api/auth/me
Authorization: Bearer {token}

响应:
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com"
    }
  }
}
```

---

## 💊 药品管理

### 4. 获取药品列表
```
GET /api/medications
Authorization: Bearer {token}

响应:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "阿司匹林",
      "dosage": "1片",
      "scheduled_time": "09:00",
      "accent": "lime",
      "created_at": "2026-01-03T09:00:00Z",
      "updated_at": "2026-01-03T09:00:00Z"
    }
  ]
}
```

### 5. 获取单个药品
```
GET /api/medications/:id
Authorization: Bearer {token}

响应:
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "阿司匹林",
    "dosage": "1片",
    "scheduled_time": "09:00",
    "accent": "lime",
    "created_at": "2026-01-03T09:00:00Z",
    "updated_at": "2026-01-03T09:00:00Z"
  }
}
```

### 6. 创建药品
```
POST /api/medications
Authorization: Bearer {token}
Content-Type: application/json

请求体:
{
  "name": "阿司匹林",
  "dosage": "1片",
  "scheduled_time": "09:00",
  "accent": "lime"
}

响应:
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "阿司匹林",
    "dosage": "1片",
    "scheduled_time": "09:00",
    "accent": "lime",
    "created_at": "2026-01-03T09:00:00Z",
    "updated_at": "2026-01-03T09:00:00Z"
  }
}
```

### 7. 更新药品
```
PUT /api/medications/:id
Authorization: Bearer {token}
Content-Type: application/json

请求体:
{
  "name": "阿司匹林（更新）",
  "dosage": "2片",
  "scheduled_time": "10:00",
  "accent": "berry"
}

响应:
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "阿司匹林（更新）",
    "dosage": "2片",
    "scheduled_time": "10:00",
    "accent": "berry",
    "updated_at": "2026-01-03T10:00:00Z"
  }
}
```

### 8. 删除药品
```
DELETE /api/medications/:id
Authorization: Bearer {token}

响应:
{
  "success": true,
  "message": "删除成功"
}
```

---

## 📸 服药记录

### 9. 获取记录列表
```
GET /api/logs
Authorization: Bearer {token}
查询参数:
  - medication_id (可选): 筛选特定药品
  - days (可选): 最近N天，默认全部
  - date (可选): 特定日期，格式 YYYY-MM-DD

响应:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "medication_id": "uuid",
      "taken_at": "2026-01-03T09:00:00Z",
      "uploaded_at": "2026-01-03T09:01:00Z",
      "time_source": "system",
      "status": "ontime",
      "image_path": "https://...",
      "image_hash": "sha256_hash",
      "created_at": "2026-01-03T09:01:00Z"
    }
  ]
}
```

### 10. 创建记录
```
POST /api/logs
Authorization: Bearer {token}
Content-Type: application/json

请求体:
{
  "medication_id": "uuid",
  "image_data": "data:image/jpeg;base64,/9j/4AAQ...",
  "taken_at": "2026-01-03T09:00:00Z",
  "time_source": "system",
  "image_hash": "sha256_hash"
}

响应:
{
  "success": true,
  "data": {
    "id": "uuid",
    "medication_id": "uuid",
    "taken_at": "2026-01-03T09:00:00Z",
    "status": "ontime",
    "image_path": "https://storage.supabase.co/...",
    "created_at": "2026-01-03T09:01:00Z"
  }
}
```

**注意**: 
- `image_data` 是 Base64 DataURL，后端需要：
  1. 解码 Base64
  2. 上传到 Storage（如 Supabase Storage）
  3. 返回公开 URL 作为 `image_path`

### 11. 获取单个记录
```
GET /api/logs/:id
Authorization: Bearer {token}

响应:
{
  "success": true,
  "data": {
    "id": "uuid",
    "medication_id": "uuid",
    "taken_at": "2026-01-03T09:00:00Z",
    "image_path": "https://...",
    ...
  }
}
```

### 12. 删除记录
```
DELETE /api/logs/:id
Authorization: Bearer {token}

响应:
{
  "success": true,
  "message": "删除成功"
}
```

---

## 📊 统计相关

### 13. 获取今日统计
```
GET /api/stats/today
Authorization: Bearer {token}

响应:
{
  "success": true,
  "data": {
    "total": 5,
    "completed": 3,
    "percentage": 60
  }
}
```

### 14. 获取本周统计
```
GET /api/stats/week
Authorization: Bearer {token}

响应:
{
  "success": true,
  "data": {
    "total_days": 7,
    "completed_days": 5,
    "on_time_rate": 0.85,
    "late_rate": 0.15
  }
}
```

---

## 🔄 同步相关

### 15. 获取同步状态
```
GET /api/sync/status
Authorization: Bearer {token}

响应:
{
  "success": true,
  "data": {
    "status": "synced",
    "lastSyncTime": "2026-01-03T09:00:00Z",
    "pendingCount": 0
  }
}
```

### 16. 推送本地变更
```
POST /api/sync/push
Authorization: Bearer {token}
Content-Type: application/json

请求体:
{
  "medications": [...],
  "logs": [...]
}

响应:
{
  "success": true,
  "synced": 5
}
```

### 17. 拉取远程变更
```
POST /api/sync/pull
Authorization: Bearer {token}

响应:
{
  "success": true,
  "data": {
    "medications": [...],
    "logs": [...]
  },
  "updated": 3
}
```

---

## 🔒 权限要求

### 认证
- 所有 API（除登录外）都需要 `Authorization: Bearer {token}` 头
- Token 通过登录接口获取
- Token 过期需要重新登录

### 数据隔离
- 用户只能访问自己的数据
- 所有查询自动过滤 `user_id`
- 使用 Row Level Security (RLS) 确保数据安全

---

## 📝 数据验证

### 药品创建/更新
- `name`: 必填，字符串，1-100字符
- `dosage`: 必填，字符串，1-50字符
- `scheduled_time`: 必填，格式 HH:mm（如 "09:00"）
- `accent`: 可选，枚举值: `lime`, `berry`, `mint`, `blue`, `purple`, `orange`

### 记录创建
- `medication_id`: 必填，UUID
- `image_data`: 必填，Base64 DataURL
- `taken_at`: 必填，ISO 8601 格式
- `time_source`: 必填，枚举值: `exif`, `system`, `manual`
- `image_hash`: 可选，SHA-256 哈希

---

## 🚨 错误响应格式

所有错误响应统一格式：

```json
{
  "success": false,
  "error": "错误消息",
  "code": "ERROR_CODE" // 可选
}
```

### HTTP 状态码
- `200` - 成功
- `400` - 请求错误（验证失败）
- `401` - 未授权（Token 无效）
- `403` - 禁止访问（权限不足）
- `404` - 资源不存在
- `500` - 服务器错误

---

## 📦 文件上传

### 照片上传流程

1. 前端发送 Base64 DataURL
2. 后端解码 Base64
3. 上传到 Storage（Supabase Storage）
4. 返回公开 URL
5. 保存 URL 到数据库

### Storage 配置
- Bucket: `medication-photos`
- 路径格式: `{user_id}/{log_id}.jpg`
- 权限: 私有（仅用户可访问）
- 大小限制: 5MB
- 支持格式: JPEG, PNG, WebP

---

## 🔄 实时同步

### WebSocket 连接
- 协议: WebSocket (WSS)
- 端点: `/realtime`
- 订阅表: `medications`, `medication_logs`

### 事件类型
- `INSERT` - 新记录插入
- `UPDATE` - 记录更新
- `DELETE` - 记录删除

### 消息格式
```json
{
  "event": "UPDATE",
  "table": "medications",
  "data": {
    "id": "uuid",
    "name": "更新后的名称",
    ...
  }
}
```

---

## 📋 实现检查清单

### 基础功能
- [ ] 用户认证（登录/登出）
- [ ] JWT Token 验证中间件
- [ ] 药品 CRUD 接口
- [ ] 记录 CRUD 接口
- [ ] 数据验证
- [ ] 错误处理

### 高级功能
- [ ] 文件上传处理
- [ ] 统计计算
- [ ] 同步接口
- [ ] WebSocket 实时同步
- [ ] 数据权限控制

### 优化
- [ ] 请求限流
- [ ] 缓存策略
- [ ] 日志记录
- [ ] 性能监控

---

**文档版本**: 1.0  
**最后更新**: 2026-01-03

